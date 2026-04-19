from django.urls import path
from .views import UploadDatasetView, EDAView

urlpatterns = [
    path('upload', UploadDatasetView.as_view(), name='upload_dataset'),
    path('eda', EDAView.as_view(), name='eda_dataset'),
]
