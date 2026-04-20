from django.contrib import admin
from .models import Dataset, ModelRecord, ChatHistory


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'uploaded_at')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    readonly_fields = ('uploaded_at',)


@admin.register(ModelRecord)
class ModelRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'model_name', 'accuracy', 'user', 'dataset', 'created_at')
    list_filter = ('user', 'model_name')
    search_fields = ('model_name', 'user__username', 'dataset__name')
    readonly_fields = ('created_at',)


@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'dataset', 'question_preview', 'created_at')
    list_filter = ('user', 'dataset')
    search_fields = ('question', 'user__username')
    readonly_fields = ('created_at',)

    def question_preview(self, obj):
        return obj.question[:60] + '…' if len(obj.question) > 60 else obj.question
    question_preview.short_description = 'Question'
