import os

import pandas as pd
from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.base import File
from django.http import FileResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatHistory, Dataset, ModelRecord
from .serializers import ChatHistorySerializer, DatasetSerializer, ModelRecordSerializer
from .utils.eda import perform_eda
from .utils.file_handler import process_csv_file


# ──────────────────────────────────────────────────────────────────────────────
# Pagination
# ──────────────────────────────────────────────────────────────────────────────

class StandardResultsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ──────────────────────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        User.objects.create_user(username=username, password=password)
        return Response({"message": "User created successfully."}, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# Datasets
# ──────────────────────────────────────────────────────────────────────────────

class UploadDatasetView(APIView):
    """
    POST /api/upload
    Upload a CSV file, create a Dataset record, and return initial EDA metadata.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.csv'):
            return Response(
                {"error": "Invalid file format. Please upload a CSV file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        dataset_name = file_obj.name

        # If this dataset name already exists for the user, return the existing record
        # so the frontend can seamlessly resume working on it.
        existing = Dataset.objects.filter(user=request.user, name=dataset_name).first()
        if existing:
            from .utils.file_handler import process_csv_file as _pcf
            try:
                preview_result = _pcf(existing.file.path)
            except Exception:
                preview_result = {}
            return Response({
                "resumed": True,
                "dataset_id": existing.id,
                "file_name": os.path.basename(existing.file.name),
                "columns": preview_result.get("columns", existing.metadata.get("columns", []) if existing.metadata else []),
                "preview": preview_result.get("preview", []),
                "message": f"Loaded your existing dataset '{dataset_name}'.",
            }, status=status.HTTP_200_OK)

        # Create DB record (file is saved to media/datasets/ automatically)
        dataset = Dataset.objects.create(
            user=request.user,
            name=dataset_name,
            file=file_obj,
        )

        try:
            result = process_csv_file(dataset.file.path)

            if "error" in result:
                dataset.delete()
                return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

            result["file_name"] = os.path.basename(dataset.file.name)
            result["dataset_id"] = dataset.id

            # Persist EDA metadata to the DB record
            dataset.metadata = {"columns": result.get("columns", [])}
            dataset.save()

            return Response(result, status=status.HTTP_200_OK)

        except Exception as exc:
            dataset.delete()
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserDatasetsView(APIView):
    """
    GET /api/datasets
    Return a paginated list of all datasets belonging to the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = Dataset.objects.filter(user=request.user)
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DatasetSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


# ──────────────────────────────────────────────────────────────────────────────
# EDA
# ──────────────────────────────────────────────────────────────────────────────

class EDAView(APIView):
    """
    GET /api/eda?dataset_id=<id>
    Run exploratory data analysis on a dataset owned by the current user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')

        if not dataset_id:
            # Legacy fallback: look up by filename
            file_name = request.query_params.get('filename')
            if file_name:
                dataset = Dataset.objects.filter(
                    user=request.user, file__icontains=file_name
                ).last()
                if not dataset:
                    return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response(
                    {"error": "dataset_id is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                dataset = Dataset.objects.get(id=dataset_id, user=request.user)
            except Dataset.DoesNotExist:
                return Response(
                    {"error": "Dataset not found or access denied."},
                    status=status.HTTP_404_NOT_FOUND
                )

        file_path = dataset.file.path
        if not os.path.exists(file_path):
            return Response({"error": "File not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        result = perform_eda(file_path)
        if "error" in result:
            return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Model Training
# ──────────────────────────────────────────────────────────────────────────────

class TrainModelView(APIView):
    """
    POST /api/train
    Train ML models on a dataset, persist the best model's .pkl to media/models/,
    and create a ModelRecord in the database.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .ml.train import train_models
        from .ml.evaluate import evaluate_models
        from .ml.preprocess import preprocess_data
        from .ml.save_model import save_model

        dataset_id = request.data.get('dataset_id')
        target_col = request.data.get('target_column')

        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not target_col:
            return Response({"error": "target_column is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        file_path = dataset.file.path
        if not os.path.exists(file_path):
            return Response({"error": "File not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        try:
            df = pd.read_csv(file_path)

            # Preprocess
            prep_results = preprocess_data(df, target_col)
            X = prep_results['X']
            y = prep_results['y']
            problem_type = prep_results['problem_type']
            features = prep_results['features']

            # Train
            models, X_test, y_test = train_models(X, y, problem_type)

            # Evaluate
            eval_results = evaluate_models(models, X_test, y_test, problem_type)
            best_model = eval_results['best_model']

            # Save model .pkl to disk
            dataset_stem = os.path.basename(dataset.file.name).rsplit('.', 1)[0]
            model_filename = f"model_{dataset.id}_{dataset_stem}.pkl"
            saved_path = save_model(best_model, model_filename)       # returns absolute path

            # Attach .pkl to ModelRecord via Django FileField
            relative_path = os.path.relpath(saved_path, settings.MEDIA_ROOT)
            model_record = ModelRecord.objects.create(
                user=request.user,
                dataset=dataset,
                model_name=eval_results['best_model_name'],
                accuracy=eval_results['best_score'],
                metrics=eval_results['all_results'],
                file=relative_path,                                   # stored as relative path
            )

            return Response({
                "model_id": model_record.id,
                "best_model": eval_results['best_model_name'],
                "score": eval_results['best_score'],
                "metrics": eval_results['all_results'],
                "features": features,
                "problem_type": problem_type,
                "model_download_url": f"/api/download-model?model_id={model_record.id}",
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserModelsView(APIView):
    """
    GET /api/models
    Return a paginated list of all trained models belonging to the authenticated user.
    Optionally filter by ?dataset_id=<id>.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = ModelRecord.objects.filter(user=request.user).select_related('dataset')

        # Optional filter by dataset
        dataset_id = request.query_params.get('dataset_id')
        if dataset_id:
            qs = qs.filter(dataset_id=dataset_id)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ModelRecordSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class DownloadModelView(APIView):
    """
    GET /api/download-model?model_id=<id>
    Stream the trained model .pkl file back to the user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get('model_id')

        if not model_id:
            return Response({"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except ModelRecord.DoesNotExist:
            return Response(
                {"error": "Model not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not model_record.file:
            return Response({"error": "No file associated with this model."}, status=status.HTTP_404_NOT_FOUND)

        full_path = model_record.file.path
        if not os.path.exists(full_path):
            return Response({"error": "Model file missing on disk."}, status=status.HTTP_404_NOT_FOUND)

        filename = os.path.basename(full_path)
        return FileResponse(open(full_path, 'rb'), as_attachment=True, filename=filename)


# ──────────────────────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────────────────────

class ChatView(APIView):
    """
    POST /api/chat  — Submit a question about the dataset.
    GET  /api/chat  — Retrieve chat history for a dataset.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .agent.workflow import process_chat_query
        dataset_id = request.data.get('dataset_id')
        question = request.data.get('question')

        if not dataset_id or not question:
            return Response(
                {"error": "dataset_id and question are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve prior chat context (last 5 exchanges)
        previous_chats = ChatHistory.objects.filter(
            dataset=dataset, user=request.user
        ).order_by('-created_at')[:5]
        history = [{"question": c.question, "answer": c.answer} for c in reversed(previous_chats)]

        # Run AI workflow
        answer = process_chat_query(dataset.id, question, history)

        # Persist exchange
        record = ChatHistory.objects.create(
            user=request.user,
            dataset=dataset,
            question=question,
            answer=answer,
        )

        return Response(
            {"answer": answer, "created_at": record.created_at},
            status=status.HTTP_200_OK
        )

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')
        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        chats = ChatHistory.objects.filter(dataset=dataset, user=request.user)
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(chats, request)
        serializer = ChatHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
