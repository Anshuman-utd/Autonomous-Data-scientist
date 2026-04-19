from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.files.storage import default_storage
from django.contrib.auth.models import User
import os

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({"error": "Username and password required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.create_user(username=username, password=password)
        return Response({"message": "User created successfully."}, status=status.HTTP_201_CREATED)

from .utils.file_handler import process_csv_file

from .models import Dataset

class UploadDatasetView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_obj.name.endswith('.csv'):
            return Response({"error": "Invalid file format. Please upload a CSV file."}, status=status.HTTP_400_BAD_REQUEST)

        # Create Database Record
        dataset = Dataset.objects.create(
            user=request.user,
            name=file_obj.name,
            file=file_obj
        )

        try:
            # Process the file using our utility
            result = process_csv_file(dataset.file.path)
            
            if "error" in result:
                # Rollback
                dataset.delete()
                return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)
            
            result["file_name"] = os.path.basename(dataset.file.name)
            result["dataset_id"] = dataset.id
            
            # Save metadata
            dataset.metadata = {
                "columns": result.get("columns", [])
            }
            dataset.save()
            
            return Response(result, status=status.HTTP_200_OK)
            
        except Exception as e:
            dataset.delete()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from .utils.eda import perform_eda

class EDAView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')
        
        if not dataset_id:
            # Fallback to filename for strict compatibility with older UI if necessary,
            # but we prefer DB lookup.
            file_name = request.query_params.get('filename')
            if file_name:
                dataset = Dataset.objects.filter(user=request.user, file__icontains=file_name).last()
            else:
                return Response({"error": "No dataset_id provided"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                dataset = Dataset.objects.get(id=dataset_id, user=request.user)
            except Dataset.DoesNotExist:
                return Response({"error": "Dataset not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
        file_path = dataset.file.path
        
        if not os.path.exists(file_path):
            return Response({"error": "File not found on disk"}, status=status.HTTP_404_NOT_FOUND)
            
        result = perform_eda(file_path)
        
        if "error" in result:
            return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response(result, status=status.HTTP_200_OK)

import pandas as pd
from django.conf import settings
from django.http import FileResponse
from .ml.preprocess import preprocess_data
from .ml.train import train_models
from .ml.evaluate import evaluate_models
from .ml.save_model import save_model

from .models import ModelRecord

class TrainModelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        dataset_id = request.data.get('dataset_id')
        target_col = request.data.get('target_column')
        
        if not dataset_id:
            return Response({"error": "No dataset_id provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
        file_path = dataset.file.path
        if not os.path.exists(file_path):
            return Response({"error": "File not found on disk"}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            # Read data
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
            
            # Save the best model
            model_filename = f"model_${dataset.id}_{os.path.basename(dataset.file.name).split('.')[0]}.pkl"
            saved_path = save_model(best_model, model_filename)
            
            # Save to Database
            model_record = ModelRecord.objects.create(
                user=request.user,
                dataset=dataset,
                model_name=eval_results['best_model_name'],
                accuracy=eval_results['best_score'],
                file_path=saved_path
            )
            
            # Prepare Response
            response_data = {
                "model_id": model_record.id,
                "best_model": eval_results['best_model_name'],
                "score": eval_results['best_score'],
                "metrics": eval_results['all_results'],
                "features": features,
                "problem_type": problem_type,
                "model_download_url": f"/api/download-model?model_id={model_record.id}"
            }
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DownloadModelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get('model_id')
        if not model_id:
            # Fallback path if requested directly by older ui logic
            model_path = request.query_params.get('model_path')
            if model_path:
                full_path = os.path.join(settings.MEDIA_ROOT, model_path)
                if not os.path.exists(full_path):
                    return Response({"error": "Model file not found"}, status=status.HTTP_404_NOT_FOUND)
                return FileResponse(open(full_path, 'rb'), as_attachment=True, filename=os.path.basename(model_path))
            return Response({"error": "No model_id provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except ModelRecord.DoesNotExist:
            return Response({"error": "Model not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
            
        full_path = os.path.join(settings.MEDIA_ROOT, model_record.file_path)
        if not os.path.exists(full_path):
            return Response({"error": "Model file missing on disk"}, status=status.HTTP_404_NOT_FOUND)
            
        return FileResponse(open(full_path, 'rb'), as_attachment=True, filename=os.path.basename(model_record.file_path))

from .models import ChatHistory
from .agent.workflow import process_chat_query

class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        dataset_id = request.data.get('dataset_id')
        question = request.data.get('question')

        if not dataset_id or not question:
            return Response({"error": "dataset_id and question are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        # Retrieve prior chat context for this dataset (limit to last 5 exchanges)
        previous_chats = ChatHistory.objects.filter(dataset=dataset, user=request.user).order_by('-timestamp')[:5]
        history = [{"question": c.question, "answer": c.answer} for c in reversed(previous_chats)]

        # Run AI workflow
        answer = process_chat_query(dataset.id, question, history)

        # Save to ChatHistory
        record = ChatHistory.objects.create(
            user=request.user,
            dataset=dataset,
            question=question,
            answer=answer
        )

        return Response({
            "answer": answer,
            "timestamp": record.timestamp
        }, status=status.HTTP_200_OK)

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')
        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except Dataset.DoesNotExist:
            return Response({"error": "Dataset not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        chats = ChatHistory.objects.filter(dataset=dataset, user=request.user).order_by('timestamp')
        return Response([{
            "question": c.question,
            "answer": c.answer,
            "timestamp": c.timestamp
        } for c in chats], status=status.HTTP_200_OK)
