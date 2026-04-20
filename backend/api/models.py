from django.db import models
from django.contrib.auth.models import User


class Dataset(models.Model):
    """
    Tracks every CSV file a user uploads.
    The actual file lives at MEDIA_ROOT/datasets/<filename>.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='datasets')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='datasets/')
    metadata = models.JSONField(blank=True, null=True)  # EDA results, column info
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'uploaded_at']),
        ]
        # A user cannot have two datasets with the same name
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_dataset_per_user')
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class ModelRecord(models.Model):
    """
    Tracks every trained ML model.
    The serialized model file lives at MEDIA_ROOT/models/<filename>.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='models')
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='models')
    model_name = models.CharField(max_length=255)
    accuracy = models.FloatField(blank=True, null=True)
    metrics = models.JSONField(blank=True, null=True)   # all per-model eval results
    file = models.FileField(upload_to='models/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['dataset']),
        ]

    def __str__(self):
        return f"{self.model_name} → {self.dataset.name} ({self.user.username})"


class ChatHistory(models.Model):
    """
    Stores every question/answer exchange between a user and their dataset.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_history')
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='chat_history')
    question = models.TextField()
    answer = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user', 'dataset', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.user.username}] Q: {self.question[:50]}…"
