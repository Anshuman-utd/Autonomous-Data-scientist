from django.db import models
from django.contrib.auth.models import User


class Dataset(models.Model):
    """
    Tracks every CSV file a user uploads.
    The actual file lives at MEDIA_ROOT/datasets/<filename>.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="datasets")
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="datasets/")
    metadata = models.JSONField(blank=True, null=True)  # EDA results, column info
    csv_data = models.TextField(
        blank=True, null=True
    )  # File content backup for ephemeral serverless/container restarts
    training_started_at = models.DateTimeField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    active_version = models.ForeignKey(
        "DatasetVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="active_datasets",
    )

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["user", "uploaded_at"]),
        ]
        # A user cannot have two datasets with the same name
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"], name="unique_dataset_per_user"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class ModelRecord(models.Model):
    """
    Tracks every trained ML model.
    The serialized model file lives at MEDIA_ROOT/models/<filename>.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="models")
    dataset = models.ForeignKey(
        Dataset, on_delete=models.CASCADE, related_name="models"
    )
    dataset_version = models.ForeignKey(
        "DatasetVersion",
        null=True,
        blank=True,
        on_delete=models.RESTRICT,
        related_name="model_runs",
    )
    model_name = models.CharField(max_length=255)
    accuracy = models.FloatField(blank=True, null=True)
    metrics = models.JSONField(blank=True, null=True)  # all per-model eval results
    file = models.FileField(upload_to="models/", blank=True, null=True)
    binary_data = models.BinaryField(
        blank=True, null=True
    )  # Serialized model persistence for ephemeral cloud hosting
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["dataset"]),
        ]

    def __str__(self):
        return f"{self.model_name} → {self.dataset.name} ({self.user.username})"


class ChatHistory(models.Model):
    """
    Stores every question/answer exchange between a user and their dataset.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="chat_history"
    )
    dataset = models.ForeignKey(
        Dataset, on_delete=models.CASCADE, related_name="chat_history"
    )
    question = models.TextField()
    answer = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["user", "dataset", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.user.username}] Q: {self.question[:50]}…"


class DatasetVersion(models.Model):
    dataset = models.ForeignKey(
        Dataset, on_delete=models.CASCADE, related_name="versions"
    )
    number = models.PositiveIntegerField()
    csv_data = models.TextField()
    metadata = models.JSONField(default=dict)
    description = models.CharField(max_length=500)
    operation = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(
                fields=["dataset", "number"], name="unique_dataset_version"
            )
        ]


class SavedInsight(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="insights")
    dataset = models.ForeignKey(
        Dataset, on_delete=models.CASCADE, related_name="insights"
    )
    dataset_version = models.ForeignKey(
        DatasetVersion, on_delete=models.RESTRICT, related_name="insights"
    )
    question = models.TextField()
    plan = models.JSONField()
    result = models.JSONField()
    interpretation = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
