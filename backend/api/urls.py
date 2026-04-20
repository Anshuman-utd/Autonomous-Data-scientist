from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    ChatView,
    DownloadModelView,
    EDAView,
    RegisterView,
    TrainModelView,
    UploadDatasetView,
    UserDatasetsView,
    UserModelsView,
)

urlpatterns = [
    # ── Auth ────────────────────────────────────────────────────────────────
    path('register',       RegisterView.as_view(),        name='register'),
    path('login',          TokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('token/refresh',  TokenRefreshView.as_view(),     name='token_refresh'),

    # ── Datasets ─────────────────────────────────────────────────────────────
    path('upload',         UploadDatasetView.as_view(),    name='upload_dataset'),
    path('datasets',       UserDatasetsView.as_view(),     name='user_datasets'),   # GET
    path('eda',            EDAView.as_view(),              name='eda_dataset'),

    # ── Models ───────────────────────────────────────────────────────────────
    path('train',          TrainModelView.as_view(),       name='train_model'),
    path('models',         UserModelsView.as_view(),       name='user_models'),     # GET
    path('download-model', DownloadModelView.as_view(),    name='download_model'),

    # ── Chat ─────────────────────────────────────────────────────────────────
    path('chat',           ChatView.as_view(),             name='chat'),
]
