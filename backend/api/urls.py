from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChatView,
    DownloadDatasetView,
    DownloadModelView,
    EDAView,
    RegisterView,
    TrainModelView,
    UploadDatasetView,
    UserDatasetsView,
    UserModelsView,
    EmailTokenObtainPairView,
    DatasetDetailView,
    DatasetTransformView,
    LivePredictView,
    ModelSchemaView,
    ExportReportView,
    ExportDeploymentView,
)

urlpatterns = [
    # ── Auth ────────────────────────────────────────────────────────────────
    path('register',       RegisterView.as_view(),        name='register'),
    path('login',          EmailTokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('token/refresh',  TokenRefreshView.as_view(),     name='token_refresh'),


    # ── Datasets ─────────────────────────────────────────────────────────────
    path('upload',           UploadDatasetView.as_view(),    name='upload_dataset'),
    path('datasets',         UserDatasetsView.as_view(),     name='user_datasets'),   # GET
    path('datasets/<int:pk>', DatasetDetailView.as_view(),   name='dataset_detail'),
    path('datasets/<int:pk>/transform', DatasetTransformView.as_view(), name='dataset_transform'),
    path('eda',              EDAView.as_view(),              name='eda_dataset'),
    path('download-dataset', DownloadDatasetView.as_view(),  name='download_dataset'),


    # ── Models & Inference ───────────────────────────────────────────────────
    path('train',              TrainModelView.as_view(),       name='train_model'),
    path('models',             UserModelsView.as_view(),       name='user_models'),     # GET
    path('predict',            LivePredictView.as_view(),      name='live_predict'),
    path('model-schema',       ModelSchemaView.as_view(),      name='model_schema'),
    path('download-model',     DownloadModelView.as_view(),    name='download_model'),
    path('export-deployment',  ExportDeploymentView.as_view(), name='export_deployment'),

    # ── Reports ──────────────────────────────────────────────────────────────
    path('export-report',      ExportReportView.as_view(),     name='export_report'),

    # ── Chat ─────────────────────────────────────────────────────────────────
    path('chat',               ChatView.as_view(),             name='chat'),
]

