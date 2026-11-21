from rest_framework import serializers
from .models import Dataset, ModelRecord, ChatHistory, DatasetVersion, SavedInsight


class DatasetSerializer(serializers.ModelSerializer):
    metadata = serializers.SerializerMethodField()
    """
    Read-only serializer for Dataset.
    Exposes file_url instead of the raw file path.
    """

    file_url = serializers.SerializerMethodField()
    owner = serializers.CharField(source="user.username", read_only=True)
    active_version_number = serializers.IntegerField(
        source="active_version.number", read_only=True
    )

    class Meta:
        model = Dataset
        fields = [
            "id",
            "owner",
            "name",
            "file_url",
            "metadata",
            "uploaded_at",
            "active_version",
            "active_version_number",
        ]
        read_only_fields = fields

    def get_metadata(self, obj):
        metadata = obj.metadata or {}
        if self.context.get("compact"):
            return {
                "columns": metadata.get("columns", []),
                "eda_report": {
                    "overview": (metadata.get("eda_report") or {}).get("overview", {})
                },
            }
        return metadata

    def get_file_url(self, obj):
        return f"/api/download-dataset?dataset_id={obj.pk}"


class ModelRecordSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for ModelRecord.
    Exposes file_url instead of the raw file path.
    """

    file_url = serializers.SerializerMethodField()
    owner = serializers.CharField(source="user.username", read_only=True)
    dataset_name = serializers.CharField(source="dataset.name", read_only=True)
    dataset_version_number = serializers.IntegerField(
        source="dataset_version.number", read_only=True
    )

    class Meta:
        model = ModelRecord
        fields = [
            "id",
            "owner",
            "dataset",
            "dataset_name",
            "dataset_version",
            "dataset_version_number",
            "model_name",
            "accuracy",
            "metrics",
            "file_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        return f"/api/download-model?model_id={obj.pk}"


class ChatHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatHistory
        fields = ["id", "question", "answer", "created_at"]
        read_only_fields = fields


class DatasetVersionSerializer(serializers.ModelSerializer):
    active = serializers.SerializerMethodField()

    class Meta:
        model = DatasetVersion
        fields = [
            "id",
            "number",
            "metadata",
            "description",
            "operation",
            "created_at",
            "active",
        ]

    def get_active(self, obj):
        return obj.dataset.active_version_id == obj.pk


class SavedInsightSerializer(serializers.ModelSerializer):
    dataset_name = serializers.CharField(source="dataset.name", read_only=True)
    version_number = serializers.IntegerField(
        source="dataset_version.number", read_only=True
    )
    stale = serializers.SerializerMethodField()

    class Meta:
        model = SavedInsight
        fields = [
            "id",
            "dataset",
            "dataset_name",
            "dataset_version",
            "version_number",
            "question",
            "plan",
            "result",
            "interpretation",
            "created_at",
            "stale",
        ]

    def get_stale(self, obj):
        return obj.dataset.active_version_id != obj.dataset_version_id
