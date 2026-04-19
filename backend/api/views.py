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
