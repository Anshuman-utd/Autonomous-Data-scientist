from django.urls import path
from .views import UploadDatasetView, EDAView, TrainModelView, DownloadModelView

urlpatterns = [
    path('upload', UploadDatasetView.as_view(), name='upload_dataset'),
    path('eda', EDAView.as_view(), name='eda_dataset'),
    path('train', TrainModelView.as_view(), name='train_model'),
    path('download-model', DownloadModelView.as_view(), name='download_model'),
]
