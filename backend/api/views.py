import os

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

from .auth import EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not full_name or not email or not password or not confirm_password:
            return Response(
                {"error": "All fields (full_name, email, password, confirm_password) are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if password != confirm_password:
            return Response(
                {"error": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email is already registered (either in email or username field)
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
            return Response(
                {"error": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Store email as both username and email to ensure database uniqueness
        User.objects.create_user(username=email, email=email, password=password, first_name=full_name)
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
            # Check metadata cache first
            columns = []
            preview = []
            if existing.metadata:
                columns = existing.metadata.get("columns", [])
                preview = existing.metadata.get("preview", [])
            
            # If metadata does not contain columns/preview (legacy record), fetch via file handler
            if not columns or not preview:
                from .utils.file_handler import process_csv_file as _pcf
                try:
                    preview_result = _pcf(existing.file.path)
                    columns = preview_result.get("columns", [])
                    preview = preview_result.get("preview", [])
                    # Store back to DB
                    existing.metadata = {
                        "columns": columns,
                        "preview": preview,
                        "eda_report": existing.metadata.get("eda_report") if existing.metadata else None
                    }
                    existing.save(update_fields=['metadata'])
                except Exception:
                    pass

            return Response({
                "resumed": True,
                "dataset_id": existing.id,
                "file_name": os.path.basename(existing.file.name),
                "columns": columns,
                "preview": preview,
                "message": f"Loaded your existing dataset '{dataset_name}'.",
            }, status=status.HTTP_200_OK)

        # Create DB record (file is saved to media/datasets/ automatically)
        dataset = Dataset.objects.create(
            user=request.user,
            name=dataset_name,
            file=file_obj,
        )

        try:
            from .utils.file_handler import process_csv_file
            result = process_csv_file(dataset.file.path)

            if "error" in result:
                dataset.delete()
                return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

            result["file_name"] = os.path.basename(dataset.file.name)
            result["dataset_id"] = dataset.id

            # Persist EDA metadata to the DB record
            dataset.metadata = {
                "columns": result.get("columns", []),
                "preview": result.get("preview", []),
                "eda_report": None
            }
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
        qs = Dataset.objects.filter(user=request.user).select_related('user')
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DatasetSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class DatasetDetailView(APIView):
    """
    DELETE /api/datasets/<id>  - Delete a dataset and its physical file.
    POST   /api/datasets/<id>/duplicate - Duplicate a dataset and its physical file.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, *args, **kwargs):
        try:
            dataset = Dataset.objects.get(id=pk, user=request.user)
            if dataset.file and os.path.exists(dataset.file.path):
                try:
                    os.remove(dataset.file.path)
                except OSError:
                    pass
            dataset.delete()
            return Response({"message": "Dataset deleted successfully."}, status=status.HTTP_200_OK)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, pk, *args, **kwargs):
        try:
            dataset = Dataset.objects.get(id=pk, user=request.user)
            original_path = dataset.file.path
            if not os.path.exists(original_path):
                return Response({"error": "Original file not found on disk."}, status=status.HTTP_404_NOT_FOUND)

            filename, ext = os.path.splitext(os.path.basename(original_path))
            dup_name = f"{dataset.name} (Copy)"
            dup_filename = f"{filename}_copy{ext}"

            suffix = 1
            while Dataset.objects.filter(user=request.user, name=dup_name).exists():
                dup_name = f"{dataset.name} (Copy {suffix})"
                dup_filename = f"{filename}_copy_{suffix}{ext}"
                suffix += 1

            dup_path = os.path.join(os.path.dirname(original_path), dup_filename)

            import shutil
            shutil.copy2(original_path, dup_path)

            from django.core.files.base import ContentFile
            new_dataset = Dataset.objects.create(
                user=request.user,
                name=dup_name,
                metadata=dataset.metadata
            )
            
            with open(dup_path, 'rb') as f:
                new_dataset.file.save(dup_filename, ContentFile(f.read()), save=True)

            return Response({
                "message": "Dataset duplicated successfully.",
                "id": new_dataset.id,
                "name": new_dataset.name
            }, status=status.HTTP_201_CREATED)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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

        # Check DB cache first
        if dataset.metadata and dataset.metadata.get("eda_report"):
            return Response(dataset.metadata["eda_report"], status=status.HTTP_200_OK)

        from .utils.eda import perform_eda
        result = perform_eda(file_path)
        if "error" in result:
            return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        # Cache in DB
        if not dataset.metadata:
            dataset.metadata = {}
        dataset.metadata["eda_report"] = result
        dataset.save(update_fields=['metadata'])

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
            import pandas as pd
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
            saved_path = save_model(best_model, model_filename)       # returns relative path

            # Attach .pkl to ModelRecord via Django FileField
            relative_path = saved_path                                 # already relative
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
        qs = ModelRecord.objects.filter(user=request.user).select_related('user', 'dataset')

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
