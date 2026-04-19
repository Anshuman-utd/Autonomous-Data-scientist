from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UploadDatasetView, EDAView, TrainModelView, DownloadModelView, RegisterView, ChatView

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('upload', UploadDatasetView.as_view(), name='upload_dataset'),
    path('eda', EDAView.as_view(), name='eda_dataset'),
    path('train', TrainModelView.as_view(), name='train_model'),
    path('download-model', DownloadModelView.as_view(), name='download_model'),
    path('chat', ChatView.as_view(), name='chat'),
]
