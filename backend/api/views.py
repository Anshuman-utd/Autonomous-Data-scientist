import os

from django.contrib.auth.models import User
from django.core.cache import cache
from django.http import FileResponse, HttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import ChatHistory, Dataset, ModelRecord
from .serializers import ChatHistorySerializer, DatasetSerializer, ModelRecordSerializer

# ──────────────────────────────────────────────────────────────────────────────
# Pagination
# ──────────────────────────────────────────────────────────────────────────────


class StandardResultsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ──────────────────────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────────────────────

from .auth import EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class EmailTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    serializer_class = EmailTokenObtainPairSerializer


class RegisterView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    permission_classes = [AllowAny]

    def post(self, request):
        full_name = request.data.get("full_name")
        email = request.data.get("email")
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        if not all(
            isinstance(v, str) for v in (full_name, email, password, confirm_password)
        ):
            return Response(
                {"error": "Enter a valid name, email and password."}, status=400
            )
        email = email.strip().lower()
        full_name = full_name.strip()
        if len(email) > 150:
            return Response(
                {"error": "Email addresses support up to 150 characters."}, status=400
            )
        if not full_name or not email or not password or not confirm_password:
            return Response(
                {
                    "error": "All fields (full_name, email, password, confirm_password) are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm_password:
            return Response(
                {"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email is already registered (either in email or username field)
        if (
            User.objects.filter(email__iexact=email).exists()
            or User.objects.filter(username__iexact=email).exists()
        ):
            return Response(
                {"error": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError

        if (
            not all(isinstance(v, str) for v in (email, full_name, password))
            or len(full_name) > 150
        ):
            return Response(
                {"error": "Enter a valid name, email and password."}, status=400
            )
        email = email.strip().lower()
        try:
            validate_email(email)
            validate_password(
                password, User(username=email, email=email, first_name=full_name)
            )
        except ValidationError as exc:
            return Response({"error": " ".join(exc.messages)}, status=400)
        # Store email as both username and email to ensure database uniqueness
        User.objects.create_user(
            username=email, email=email, password=password, first_name=full_name
        )
        return Response(
            {"message": "User created successfully."}, status=status.HTTP_201_CREATED
        )


# ──────────────────────────────────────────────────────────────────────────────
# Datasets
# ──────────────────────────────────────────────────────────────────────────────

from .utils.file_handler import ensure_dataset_file_on_disk


class EDAView(APIView):
    """
    GET /api/eda?dataset_id=<id>
    Run exploratory data analysis on a dataset owned by the current user.
    Leverages Redis/LocMem caching for sub-millisecond repeated queries.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get("dataset_id")

        if not dataset_id:
            file_name = request.query_params.get("filename")
            if file_name:
                dataset = Dataset.objects.filter(
                    user=request.user, file__icontains=file_name
                ).last()
                if not dataset:
                    return Response(
                        {"error": "Dataset not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
            else:
                return Response(
                    {"error": "dataset_id is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            try:
                dataset = Dataset.objects.get(id=dataset_id, user=request.user)
            except (Dataset.DoesNotExist, ValueError):
                return Response(
                    {"error": "Dataset not found or access denied."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # 1. Check Redis / Memory cache
        cache_key = f"eda_dataset_{dataset.id}_v{dataset.active_version_id}"
        try:
            cached_eda = cache.get(cache_key)
            if cached_eda:
                return Response(cached_eda, status=status.HTTP_200_OK)
        except Exception:
            pass

        # 2. Check DB metadata cache
        if dataset.metadata and dataset.metadata.get("eda_report"):
            try:
                cache.set(cache_key, dataset.metadata["eda_report"], timeout=600)
            except Exception:
                pass
            return Response(dataset.metadata["eda_report"], status=status.HTTP_200_OK)

        file_path = ensure_dataset_file_on_disk(dataset)
        if not file_path or not os.path.exists(file_path):
            return Response(
                {"error": "File not found on disk."}, status=status.HTTP_404_NOT_FOUND
            )

        from .utils.eda import perform_eda

        result = perform_eda(file_path)
        if "error" in result:
            return Response(
                {"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST
            )

        # Cache in DB and Redis
        if not dataset.metadata:
            dataset.metadata = {}
        dataset.metadata["eda_report"] = result
        Dataset.objects.filter(
            pk=dataset.pk, active_version_id=dataset.active_version_id
        ).update(metadata=dataset.metadata)
        try:
            cache.set(cache_key, result, timeout=600)
        except Exception:
            pass

        return Response(result, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Automated Data Cleaning & Smart Transforms
# ──────────────────────────────────────────────────────────────────────────────


class LivePredictView(APIView):
    """
    POST /api/predict
    Live inference endpoint for the "What-If" simulator.
    Accepts: { model_id: int, inputs: { feature: value } }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .ml.preprocess import predict_with_bundle

        model_id = request.data.get("model_id")
        inputs = request.data.get("inputs", {})

        if not model_id:
            return Response(
                {"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response(
                {"error": "Model not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        from .utils.artifacts import load_model_bundle

        bundle = load_model_bundle(model_record)

        if bundle is None:
            return Response(
                {"error": "Failed to load model artifact."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # If legacy raw model rather than dictionary bundle, wrap it
        if not isinstance(bundle, dict):
            model_obj = bundle
            fitted_features = getattr(model_obj, "feature_names_in_", None)
            if fitted_features is not None:
                features = [str(f) for f in fitted_features]
            else:
                features = [
                    str(f) for f in (model_record.metrics or {}).get("features", [])
                ]

            target_col = (model_record.metrics or {}).get("target_column")
            if not features:
                features = [str(k) for k in inputs.keys() if k != target_col]
            elif target_col and target_col in features:
                features = [f for f in features if f != target_col]

            problem_type = (model_record.metrics or {}).get(
                "problem_type", "classification"
            )
            bundle = {
                "model": model_obj,
                "features": features,
                "problem_type": problem_type,
                "numeric_cols": features,
                "categorical_cols": [],
                "encoders": {},
                "scaler": None,
                "target_col": target_col,
            }
        else:
            # Bundle is dict: guarantee features strictly excludes target column
            model_obj = bundle.get("model")
            fitted_features = getattr(model_obj, "feature_names_in_", None)
            if fitted_features is not None:
                bundle["features"] = [str(f) for f in fitted_features]
            target_col = bundle.get("target_col") or (model_record.metrics or {}).get(
                "target_column"
            )
            if target_col and target_col in bundle.get("features", []):
                bundle["features"] = [f for f in bundle["features"] if f != target_col]

        try:
            result = predict_with_bundle(bundle, inputs)
            result["model_id"] = model_record.id
            result["model_name"] = model_record.model_name
            result["target_column"] = bundle.get("target_col") or (
                model_record.metrics or {}
            ).get("target_column", "Prediction")

            result["dataset_version_id"] = model_record.dataset_version_id
            return Response(result, status=status.HTTP_200_OK)
        except (ValueError, TypeError) as exc:
            return Response({"error": str(exc)}, status=400)
        except Exception:
            return Response(
                {
                    "error": "This model could not run inference. Retrain it to generate a compatible artifact."
                },
                status=400,
            )


class ModelSchemaView(APIView):
    """
    GET /api/model-schema?model_id=<id>
    Returns input features schema, min/max ranges, and feature importance for What-If simulator.
    Strictly excludes the target column from schema_info to prevent model fit mismatch errors.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get("model_id")
        if not model_id:
            return Response(
                {"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response(
                {"error": "Model not found."}, status=status.HTTP_404_NOT_FOUND
            )

        metrics = model_record.metrics or {}
        schema_info = metrics.get("schema_info", [])
        features = list(metrics.get("features", []))
        feature_importance = metrics.get("feature_importance", [])
        problem_type = metrics.get("problem_type", "classification")
        target_column = metrics.get("target_column", "")
        target_classes = metrics.get("target_classes", [])

        from .utils.artifacts import load_model_bundle

        loaded = load_model_bundle(model_record)
        model_obj = loaded.get("model") if isinstance(loaded, dict) else loaded

        # If model has feature_names_in_, it is the absolute ground truth of features
        if model_obj is not None and hasattr(model_obj, "feature_names_in_"):
            features = [str(f) for f in model_obj.feature_names_in_]

        # Auto-deduce target_column if not explicitly recorded in metrics
        if not target_column and model_record.dataset:
            dataset = model_record.dataset
            cols = list((dataset.metadata or {}).get("columns", []))
            if not cols:
                ensure_dataset_file_on_disk(dataset)
                if dataset.file and os.path.exists(dataset.file.path):
                    import pandas as pd

                    try:
                        df_sample = pd.read_csv(dataset.file.path, nrows=5)
                        cols = list(df_sample.columns)
                    except Exception:
                        pass
            if cols:
                non_feature_cols = [c for c in cols if c not in features]
                if non_feature_cols:
                    target_column = non_feature_cols[-1]
                else:
                    target_column = cols[-1]

        # Ensure features list strictly never contains target_column
        if target_column and target_column in features:
            features = [f for f in features if f != target_column]

        # Fallback feature importance calculation for legacy models
        if not feature_importance:
            try:
                from .ml.evaluate import calculate_feature_importance

                if model_obj is not None:
                    cols = (model_record.dataset.metadata or {}).get("columns", [])
                    feat_list = (
                        [c for c in cols if c != target_column] if cols else features
                    )
                    n_in = getattr(model_obj, "n_features_in_", len(feat_list))
                    if len(feat_list) >= n_in:
                        feat_list = feat_list[:n_in]
                    feature_importance = calculate_feature_importance(
                        model_obj, feat_list, problem_type
                    )
            except Exception:
                pass
        # Sanitize existing schema_info so target_column is NEVER present as an input
        if schema_info:
            schema_info = [
                f
                for f in schema_info
                if f.get("name") != target_column
                and (not features or f.get("name") in features)
            ]

        # Synthesize schema_info if absent
        if not schema_info:
            dataset = model_record.dataset
            ensure_dataset_file_on_disk(dataset)
            if dataset.file and os.path.exists(dataset.file.path):
                import pandas as pd

                df = pd.read_csv(dataset.file.path)
                schema_info = []
                allowed_cols = (
                    features
                    if features
                    else [c for c in df.columns if c != target_column]
                )
                for col in allowed_cols:
                    if col not in df.columns or col == target_column:
                        continue
                    if pd.api.types.is_numeric_dtype(df[col]):
                        c_min = (
                            float(df[col].min()) if not pd.isna(df[col].min()) else 0.0
                        )
                        c_max = (
                            float(df[col].max())
                            if not pd.isna(df[col].max())
                            else 100.0
                        )
                        c_med = (
                            float(df[col].median())
                            if not pd.isna(df[col].median())
                            else 0.0
                        )
                        diff = c_max - c_min
                        step = (
                            1.0
                            if diff > 50 and isinstance(c_min, int)
                            else (round(diff / 100.0, 3) if diff > 0 else 0.1)
                        )
                        schema_info.append(
                            {
                                "name": col,
                                "type": "numeric",
                                "min": round(c_min, 2),
                                "max": round(c_max, 2),
                                "mean": round(float(df[col].mean()), 2),
                                "median": round(c_med, 2),
                                "step": step if step > 0 else 0.1,
                                "default": round(c_med, 2),
                            }
                        )
                    else:
                        opts = [str(x) for x in df[col].dropna().unique()[:30]]
                        schema_info.append(
                            {
                                "name": col,
                                "type": "categorical",
                                "options": opts,
                                "default": opts[0] if opts else "",
                            }
                        )

        return Response(
            {
                "model_id": model_record.id,
                "model_name": model_record.model_name,
                "score": model_record.accuracy,
                "problem_type": problem_type,
                "target_column": target_column,
                "target_classes": target_classes,
                "schema_info": schema_info,
                "features": features,
                "feature_importance": feature_importance,
            },
            status=status.HTTP_200_OK,
        )


# ──────────────────────────────────────────────────────────────────────────────
# One-Click Executive Report Export (PDF / HTML)
# ──────────────────────────────────────────────────────────────────────────────


class ExportReportView(APIView):
    """
    GET /api/export-report?dataset_id=<id>&model_id=<id>&download=1
    Generates an executive-grade, printable HTML Data Science Briefing Report.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from .utils.report_generator import generate_html_report

        dataset_id = request.query_params.get("dataset_id")
        model_id = request.query_params.get("model_id")
        download = request.query_params.get("download") == "1"

        if not dataset_id:
            return Response(
                {"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND
            )

        model_record = None
        if model_id:
            model_record = ModelRecord.objects.filter(
                id=model_id, dataset=dataset, user=request.user
            ).first()
            if model_record is None:
                return Response(
                    {"error": "Model not found for this dataset."}, status=404
                )
        if not model_record:
            model_record = (
                ModelRecord.objects.filter(dataset=dataset, user=request.user)
                .filter(dataset_version_id=dataset.active_version_id)
                .order_by("-created_at")
                .first()
            )

        eda_data = dataset.metadata.get("eda_report") if dataset.metadata else None
        if not eda_data:
            from .utils.eda import perform_eda

            file_path = ensure_dataset_file_on_disk(dataset)
            if file_path and os.path.exists(file_path):
                eda_data = perform_eda(file_path)

        if model_record and model_record.dataset_version_id:
            eda_data = model_record.dataset_version.metadata.get("eda_report")
        html_content = generate_html_report(dataset, eda_data, model_record)

        response = HttpResponse(html_content, content_type="text/html; charset=utf-8")
        disposition = "attachment" if download else "inline"
        safe_name = f"dataset_{dataset.pk}"
        response["Content-Disposition"] = (
            f'{disposition}; filename="Executive_Report_{safe_name}.html"'
        )
        return response


# ──────────────────────────────────────────────────────────────────────────────
# Standalone Deployment Export (FastAPI + Dockerfile)
# ──────────────────────────────────────────────────────────────────────────────


class ExportDeploymentView(APIView):
    """
    GET /api/export-deployment?model_id=<id>
    Generates a production-ready deployment ZIP containing:
    - model.pkl (serialized bundle)
    - app.py (FastAPI inference REST microservice)
    - Dockerfile (Python 3.10 container)
    - requirements.txt
    - README.md (quickstart & cURL documentation)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        import io
        import zipfile
        import json

        model_id = request.query_params.get("model_id")
        if not model_id:
            return Response(
                {"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response(
                {"error": "Model not found."}, status=status.HTTP_404_NOT_FOUND
            )

        from .utils.artifacts import model_bytes as get_model_bytes

        model_bytes = get_model_bytes(model_record)

        if not model_bytes:
            return Response(
                {"error": "Model file content unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        metrics = model_record.metrics or {}
        model_name = model_record.model_name
        features = metrics.get("features", [])
        problem_type = metrics.get("problem_type", "classification")

        sample_input = {feat: 1.0 for feat in features}
        sample_curl_json = json.dumps({"inputs": sample_input}, indent=2)

        # Ship the exact server inference implementation: no divergent preprocessing.
        from pathlib import Path

        predictor_source = (Path(__file__).parent / "ml" / "preprocess.py").read_text()
        app_code = """from pathlib import Path
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any
from predictor import predict_with_bundle
bundle = joblib.load(Path(__file__).with_name('model.pkl'))
app = FastAPI(title='Exported model inference')
class Request(BaseModel):
    inputs: dict[str, Any]
@app.get('/health')
def health():
    return {'status':'ready', 'source_version':bundle.get('dataset_version_id')}
@app.post('/predict')
def predict(request: Request):
    try:
        return predict_with_bundle(bundle, request.inputs)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
"""
        import sklearn, pandas, numpy, joblib

        reqs_code = f"fastapi>=0.111,<1\nuvicorn>=0.30,<1\npydantic>=2.7,<3\nscikit-learn=={sklearn.__version__}\npandas=={pandas.__version__}\nnumpy=={numpy.__version__}\njoblib=={joblib.__version__}\n"
        dockerfile_code = 'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]\n'
        sample_input = {
            field["name"]: field.get("default")
            for field in metrics.get("schema_info", [])
        }
        readme_code = f"# Exported inference bundle\n\nSource dataset version: {model_record.dataset_version_id or 'unknown (legacy)'}\n\nRun `pip install -r requirements.txt` then `uvicorn app:app --host 0.0.0.0 --port 8000`.\nUse Python 3.11 and the pinned scientific dependencies. Only load trusted serialized models.\n\nPOST /predict with JSON:\n```json\n{json.dumps({'inputs':sample_input},indent=2)}\n```\n\nThis downloads deployment files; hosting, authentication, TLS, request limits and network access must be configured by the operator before public use.\n"

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("model.pkl", model_bytes)
            z.writestr("app.py", app_code)
            z.writestr("predictor.py", predictor_source)
            z.writestr("Dockerfile", dockerfile_code)
            z.writestr("requirements.txt", reqs_code)
            z.writestr("README.md", readme_code)

        zip_buffer.seek(0)
        zip_filename = f"deployment_{model_record.id}_{model_record.model_name.replace(' ', '_')}.zip"

        return FileResponse(
            zip_buffer,
            as_attachment=True,
            filename=zip_filename,
            content_type="application/zip",
        )


class UserModelsView(APIView):
    """
    GET /api/models
    Return a paginated list of all trained models belonging to the authenticated user.
    Optionally filter by ?dataset_id=<id>.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = ModelRecord.objects.filter(user=request.user).select_related(
            "user", "dataset", "dataset_version"
        )

        # Optional filter by dataset
        dataset_id = request.query_params.get("dataset_id")
        if dataset_id:
            qs = qs.filter(dataset_id=dataset_id)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ModelRecordSerializer(
            page, many=True, context={"request": request}
        )
        return paginator.get_paginated_response(serializer.data)


class DownloadModelView(APIView):
    """
    GET /api/download-model?model_id=<id>
    Stream the trained model .pkl file back to the user.
    Falls back gracefully to binary_data stored in PostgreSQL if Render ephemeral disk wiped the file.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get("model_id")

        if not model_id:
            return Response(
                {"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response(
                {"error": "Model not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = f"model_{model_record.id}.pkl"
        if model_record.file and model_record.file.name:
            filename = os.path.basename(model_record.file.name)

        from .utils.artifacts import model_bytes
        import io

        payload = model_bytes(model_record)
        if payload:
            return FileResponse(
                io.BytesIO(payload), as_attachment=True, filename=filename
            )
        return Response({"error": "Model artifact is unavailable."}, status=404)


class DownloadDatasetView(APIView):
    """
    GET /api/download-dataset?dataset_id=<id>
    Stream dataset CSV file with authentication and persistent DB fallback.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get("dataset_id")
        if not dataset_id:
            return Response(
                {"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = (
            dataset.name if dataset.name.endswith(".csv") else f"{dataset.name}.csv"
        )
        file_path = ensure_dataset_file_on_disk(dataset)

        if file_path and os.path.exists(file_path):
            return FileResponse(
                open(file_path, "rb"), as_attachment=True, filename=filename
            )

        if dataset.csv_data:
            import io

            return FileResponse(
                io.BytesIO(dataset.csv_data.encode("utf-8")),
                as_attachment=True,
                filename=filename,
            )

        return Response(
            {"error": "Dataset file missing on disk."}, status=status.HTTP_404_NOT_FOUND
        )


# ──────────────────────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────────────────────


class ChatView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"
    """
    POST /api/chat  — Submit a question about the dataset.
    GET  /api/chat  — Retrieve chat history for a dataset.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .agent.workflow import process_chat_query

        dataset_id = request.data.get("dataset_id")
        question = request.data.get("question")

        if not dataset_id or not question:
            return Response(
                {"error": "dataset_id and question are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Retrieve prior chat context (last 5 exchanges)
        previous_chats = ChatHistory.objects.filter(
            dataset=dataset, user=request.user
        ).order_by("-created_at")[:5]
        history = [
            {"question": c.question, "answer": c.answer}
            for c in reversed(previous_chats)
        ]

        if not isinstance(question, str) or len(question) > 4000:
            return Response(
                {"error": "Questions must be between 1 and 4,000 characters."},
                status=400,
            )
        try:
            answer = process_chat_query(
                dataset.id, question, history, user_id=request.user.pk
            )
        except (ValueError, RuntimeError):
            return Response(
                {
                    "error": "The analyst is unavailable. Configure GROQ_API_KEY or try again later. Your message was not saved."
                },
                status=503,
            )

        # Persist exchange
        record = ChatHistory.objects.create(
            user=request.user,
            dataset=dataset,
            question=question,
            answer=answer,
        )

        return Response(
            {"answer": answer, "created_at": record.created_at},
            status=status.HTTP_200_OK,
        )

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get("dataset_id")
        if not dataset_id:
            return Response(
                {"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND,
            )

        chats = ChatHistory.objects.filter(dataset=dataset, user=request.user).order_by(
            "-created_at", "-id"
        )
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(chats, request)
        serializer = ChatHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
