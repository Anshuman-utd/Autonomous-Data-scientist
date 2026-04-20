from rest_framework import serializers
from .models import Dataset, ModelRecord, ChatHistory


class DatasetSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for Dataset.
    Exposes file_url instead of the raw file path.
    """
    file_url = serializers.SerializerMethodField()
    owner = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Dataset
        fields = [
            'id',
            'owner',
            'name',
            'file_url',
            'metadata',
            'uploaded_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


class ModelRecordSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for ModelRecord.
    Exposes file_url instead of the raw file path.
    """
    file_url = serializers.SerializerMethodField()
    owner = serializers.CharField(source='user.username', read_only=True)
    dataset_name = serializers.CharField(source='dataset.name', read_only=True)

    class Meta:
        model = ModelRecord
        fields = [
            'id',
            'owner',
            'dataset',
            'dataset_name',
            'model_name',
            'accuracy',
            'metrics',
            'file_url',
            'created_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


class ChatHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatHistory
        fields = ['id', 'question', 'answer', 'created_at']
        read_only_fields = fields
