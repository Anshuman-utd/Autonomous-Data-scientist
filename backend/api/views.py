from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.core.files.storage import default_storage
import os

from .utils.file_handler import process_csv_file

class UploadDatasetView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_obj.name.endswith('.csv'):
            return Response({"error": "Invalid file format. Please upload a CSV file."}, status=status.HTTP_400_BAD_REQUEST)

        # Save file to media directory temporarily
        file_name = default_storage.save(file_obj.name, file_obj)
        file_path = default_storage.path(file_name)

        try:
            # Process the file using our utility
            result = process_csv_file(file_path)
            
            if "error" in result:
                return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)
            
            result["file_name"] = file_name
            
            return Response(result, status=status.HTTP_200_OK)
            
        finally:
            # Clean up the file after processing to save space (since we only need a preview right now)
            # In later phases, we might want to keep the file for model training.
            # But for Phase 1, the prompt says "Save it to the server". So we can optionally delete or keep.
            # We'll keep it for now as part of "Save it to the server" requirement.
            pass

from .utils.eda import perform_eda

class EDAView(APIView):
    def get(self, request, *args, **kwargs):
        file_name = request.query_params.get('filename')
        
        if not file_name:
            return Response({"error": "No filename provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        file_path = default_storage.path(file_name)
        
        if not os.path.exists(file_path):
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
            
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

class TrainModelView(APIView):
    def post(self, request, *args, **kwargs):
        file_name = request.data.get('filename')
        target_col = request.data.get('target_column')
        
        if not file_name:
            return Response({"error": "No filename provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        file_path = default_storage.path(file_name)
        if not os.path.exists(file_path):
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
            
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
            model_filename = f"model_{file_name.split('.')[0]}.pkl"
            saved_path = save_model(best_model, model_filename)
            
            # Prepare Response
            response_data = {
                "best_model": eval_results['best_model_name'],
                "score": eval_results['best_score'],
                "metrics": eval_results['all_results'],
                "features": features,
                "problem_type": problem_type,
                "model_download_url": f"/api/download-model?model_path={saved_path}"
            }
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DownloadModelView(APIView):
    def get(self, request, *args, **kwargs):
        model_path = request.query_params.get('model_path')
        if not model_path:
            return Response({"error": "No model path provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        full_path = os.path.join(settings.MEDIA_ROOT, model_path)
        if not os.path.exists(full_path):
            return Response({"error": "Model file not found"}, status=status.HTTP_404_NOT_FOUND)
            
        return FileResponse(open(full_path, 'rb'), as_attachment=True, filename=os.path.basename(model_path))
