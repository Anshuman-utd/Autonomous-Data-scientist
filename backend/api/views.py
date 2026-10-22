import os

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import File
from django.http import FileResponse, HttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatHistory, Dataset, ModelRecord
from .serializers import ChatHistorySerializer, DatasetSerializer, ModelRecordSerializer



# ──────────────────────────────────────────────────────────────────────────────
# Pagination
# ──────────────────────────────────────────────────────────────────────────────

class StandardResultsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ──────────────────────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────────────────────

from .auth import EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not full_name or not email or not password or not confirm_password:
            return Response(
                {"error": "All fields (full_name, email, password, confirm_password) are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if password != confirm_password:
            return Response(
                {"error": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email is already registered (either in email or username field)
        if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
            return Response(
                {"error": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Store email as both username and email to ensure database uniqueness
        User.objects.create_user(username=email, email=email, password=password, first_name=full_name)
        return Response({"message": "User created successfully."}, status=status.HTTP_201_CREATED)



# ──────────────────────────────────────────────────────────────────────────────
# Datasets
# ──────────────────────────────────────────────────────────────────────────────

from .utils.file_handler import ensure_dataset_file_on_disk


class UploadDatasetView(APIView):
    """
    POST /api/upload
    Upload a CSV file, create a Dataset record, and return initial EDA metadata.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.csv'):
            return Response(
                {"error": "Invalid file format. Please upload a CSV file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        dataset_name = file_obj.name

        # If this dataset name already exists for the user, return the existing record
        # so the frontend can seamlessly resume working on it.
        existing = Dataset.objects.filter(user=request.user, name=dataset_name).first()
        if existing:
            # Check metadata cache first
            columns = []
            preview = []
            if existing.metadata:
                columns = existing.metadata.get("columns", [])
                preview = existing.metadata.get("preview", [])
            
            # If metadata does not contain columns/preview (legacy record), fetch via file handler
            if not columns or not preview:
                from .utils.file_handler import process_csv_file as _pcf
                try:
                    ensure_dataset_file_on_disk(existing)
                    preview_result = _pcf(existing.file.path)
                    columns = preview_result.get("columns", [])
                    preview = preview_result.get("preview", [])
                    # Store back to DB
                    existing.metadata = {
                        "columns": columns,
                        "preview": preview,
                        "eda_report": existing.metadata.get("eda_report") if existing.metadata else None
                    }
                    existing.save(update_fields=['metadata'])
                except Exception:
                    pass

            return Response({
                "resumed": True,
                "dataset_id": existing.id,
                "file_name": os.path.basename(existing.file.name),
                "columns": columns,
                "preview": preview,
                "message": f"Loaded your existing dataset '{dataset_name}'.",
            }, status=status.HTTP_200_OK)

        # Read CSV content into memory for DB persistence across ephemeral container restarts
        csv_text = None
        try:
            file_obj.seek(0)
            csv_text = file_obj.read().decode('utf-8', errors='ignore')
            file_obj.seek(0)
        except Exception:
            pass

        # Create DB record (file is saved to media/datasets/ automatically)
        dataset = Dataset.objects.create(
            user=request.user,
            name=dataset_name,
            file=file_obj,
            csv_data=csv_text,
        )

        try:
            from .utils.file_handler import process_csv_file
            result = process_csv_file(dataset.file.path)

            if "error" in result:
                dataset.delete()
                return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

            result["file_name"] = os.path.basename(dataset.file.name)
            result["dataset_id"] = dataset.id

            # Persist EDA metadata to the DB record
            dataset.metadata = {
                "columns": result.get("columns", []),
                "preview": result.get("preview", []),
                "eda_report": None
            }
            dataset.save()

            return Response(result, status=status.HTTP_200_OK)

        except Exception as exc:
            dataset.delete()
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserDatasetsView(APIView):
    """
    GET /api/datasets
    Return a paginated list of all datasets belonging to the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = Dataset.objects.filter(user=request.user).select_related('user')
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DatasetSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class DatasetDetailView(APIView):
    """
    DELETE /api/datasets/<id>  - Delete a dataset and its physical file.
    POST   /api/datasets/<id>/duplicate - Duplicate a dataset and its physical file.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, *args, **kwargs):
        try:
            dataset = Dataset.objects.get(id=pk, user=request.user)
            if dataset.file and os.path.exists(dataset.file.path):
                try:
                    os.remove(dataset.file.path)
                except OSError:
                    pass
            dataset.delete()
            return Response({"message": "Dataset deleted successfully."}, status=status.HTTP_200_OK)
        except (Dataset.DoesNotExist, ValueError):
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, pk, *args, **kwargs):
        try:
            dataset = Dataset.objects.get(id=pk, user=request.user)
            original_path = ensure_dataset_file_on_disk(dataset)
            if not original_path or not os.path.exists(original_path):
                return Response({"error": "Original file not found on disk."}, status=status.HTTP_404_NOT_FOUND)

            filename, ext = os.path.splitext(os.path.basename(original_path))
            dup_name = f"{dataset.name} (Copy)"
            dup_filename = f"{filename}_copy{ext}"

            suffix = 1
            while Dataset.objects.filter(user=request.user, name=dup_name).exists():
                dup_name = f"{dataset.name} (Copy {suffix})"
                dup_filename = f"{filename}_copy_{suffix}{ext}"
                suffix += 1

            dup_path = os.path.join(os.path.dirname(original_path), dup_filename)

            import shutil
            shutil.copy2(original_path, dup_path)

            from django.core.files.base import ContentFile
            new_dataset = Dataset.objects.create(
                user=request.user,
                name=dup_name,
                metadata=dataset.metadata,
                csv_data=dataset.csv_data
            )
            
            with open(dup_path, 'rb') as f:
                new_dataset.file.save(dup_filename, ContentFile(f.read()), save=True)

            return Response({
                "message": "Dataset duplicated successfully.",
                "id": new_dataset.id,
                "name": new_dataset.name
            }, status=status.HTTP_201_CREATED)
        except (Dataset.DoesNotExist, ValueError):
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# ──────────────────────────────────────────────────────────────────────────────
# EDA
# ──────────────────────────────────────────────────────────────────────────────

class EDAView(APIView):
    """
    GET /api/eda?dataset_id=<id>
    Run exploratory data analysis on a dataset owned by the current user.
    Leverages Redis/LocMem caching for sub-millisecond repeated queries.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')

        if not dataset_id:
            file_name = request.query_params.get('filename')
            if file_name:
                dataset = Dataset.objects.filter(
                    user=request.user, file__icontains=file_name
                ).last()
                if not dataset:
                    return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response(
                    {"error": "dataset_id is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            try:
                dataset = Dataset.objects.get(id=dataset_id, user=request.user)
            except (Dataset.DoesNotExist, ValueError):
                return Response(
                    {"error": "Dataset not found or access denied."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 1. Check Redis / Memory cache
        cache_key = f"eda_dataset_{dataset.id}"
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
            return Response({"error": "File not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        from .utils.eda import perform_eda
        result = perform_eda(file_path)
        if "error" in result:
            return Response({"error": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        # Cache in DB and Redis
        if not dataset.metadata:
            dataset.metadata = {}
        dataset.metadata["eda_report"] = result
        dataset.save(update_fields=['metadata'])
        try:
            cache.set(cache_key, result, timeout=600)
        except Exception:
            pass

        return Response(result, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────────────────────
# Automated Data Cleaning & Smart Transforms
# ──────────────────────────────────────────────────────────────────────────────

class DatasetTransformView(APIView):
    """
    POST /api/datasets/<id>/transform
    Automated Data Cleaning & Smart Transforms.
    Actions:
    - remove_outliers (column: str)
    - drop_columns (columns: [str])
    - impute_missing (column: str, strategy: 'median'|'mean'|'mode'|'zero'|'drop')
    - remove_duplicates
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        try:
            dataset = Dataset.objects.get(id=pk, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)

        file_path = ensure_dataset_file_on_disk(dataset)
        if not file_path or not os.path.exists(file_path):
            return Response({"error": "Dataset file missing on disk."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if not action:
            return Response({"error": "action is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import pandas as pd
            import numpy as np
            from .utils.eda import perform_eda

            df = pd.read_csv(file_path)
            orig_rows = len(df)
            orig_cols = len(df.columns)
            diff_msg = ""

            if action == 'remove_outliers':
                col = request.data.get('column')
                if col and col in df.columns:
                    q1 = df[col].quantile(0.25)
                    q3 = df[col].quantile(0.75)
                    iqr = q3 - q1
                    low = q1 - 1.5 * iqr
                    high = q3 + 1.5 * iqr
                    df = df[(df[col] >= low) & (df[col] <= high) | df[col].isna()]
                    removed = orig_rows - len(df)
                    diff_msg = f"Removed {removed} detected outliers from '{col}'."
                else:
                    # Remove outliers across all numerical columns
                    num_cols = df.select_dtypes(include=[np.number]).columns
                    mask = pd.Series(True, index=df.index)
                    for c in num_cols:
                        q1 = df[c].quantile(0.25)
                        q3 = df[c].quantile(0.75)
                        iqr = q3 - q1
                        mask &= (df[c] >= (q1 - 1.5 * iqr)) & (df[c] <= (q3 + 1.5 * iqr)) | df[c].isna()
                    df = df[mask]
                    removed = orig_rows - len(df)
                    diff_msg = f"Removed {removed} outliers across numerical features."

            elif action == 'drop_columns':
                cols_to_drop = request.data.get('columns', [])
                if isinstance(cols_to_drop, str):
                    cols_to_drop = [cols_to_drop]
                valid_cols = [c for c in cols_to_drop if c in df.columns]
                if valid_cols:
                    df = df.drop(columns=valid_cols)
                    diff_msg = f"Dropped {len(valid_cols)} redundant/excessive columns: {', '.join(valid_cols)}."
                else:
                    return Response({"error": "No matching columns found to drop."}, status=status.HTTP_400_BAD_REQUEST)

            elif action == 'impute_missing':
                col = request.data.get('column')
                strategy = request.data.get('strategy', 'median')
                if col and col in df.columns:
                    null_count = int(df[col].isnull().sum())
                    if pd.api.types.is_numeric_dtype(df[col]):
                        if strategy == 'mean':
                            val = df[col].mean()
                        elif strategy == 'zero':
                            val = 0
                        else:
                            val = df[col].median()
                        df[col] = df[col].fillna(val)
                    else:
                        val = df[col].mode()[0] if not df[col].mode().empty else "Unknown"
                        df[col] = df[col].fillna(val)
                    diff_msg = f"Imputed {null_count} missing values in '{col}' using {strategy}."
                else:
                    return Response({"error": f"Column '{col}' not found."}, status=status.HTTP_400_BAD_REQUEST)

            elif action == 'remove_duplicates':
                init_count = len(df)
                df = df.drop_duplicates()
                removed = init_count - len(df)
                diff_msg = f"Removed {removed} duplicate rows."

            else:
                return Response({"error": f"Unknown transformation action '{action}'."}, status=status.HTTP_400_BAD_REQUEST)

            # Persist transformed dataframe
            df.to_csv(file_path, index=False)
            csv_str = df.to_csv(index=False)
            dataset.csv_data = csv_str

            # Invalidate Redis/memory cache safely
            cache_key = f"eda_dataset_{dataset.id}"
            try:
                cache.delete(cache_key)
            except Exception:
                pass

            new_eda = perform_eda(file_path)

            preview_df = df.head(5).where(pd.notnull(df.head(5)), None)
            dataset.metadata = {
                "columns": df.columns.tolist(),
                "preview": preview_df.to_dict(orient='records'),
                "eda_report": new_eda
            }
            dataset.save()
            try:
                cache.set(cache_key, new_eda, timeout=600)
            except Exception:
                pass

            return Response({
                "message": diff_msg,
                "rows_before": orig_rows,
                "rows_after": len(df),
                "cols_before": orig_cols,
                "cols_after": len(df.columns),
                "eda_report": new_eda,
                "columns": df.columns.tolist(),
                "preview": preview_df.to_dict(orient='records')
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"Transform failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ──────────────────────────────────────────────────────────────────────────────
# Model Training
# ──────────────────────────────────────────────────────────────────────────────

class TrainModelView(APIView):
    """
    POST /api/train
    Train ML models on a dataset, persist the best model's .pkl bundle to media/models/,
    compute feature importances (Tree weights / SHAP), and create a ModelRecord in the database.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .ml.train import train_models
        from .ml.evaluate import evaluate_models
        from .ml.preprocess import preprocess_data
        from .ml.save_model import save_model

        dataset_id = request.data.get('dataset_id')
        target_col = request.data.get('target_column')

        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not target_col:
            return Response({"error": "target_column is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        file_path = ensure_dataset_file_on_disk(dataset)
        if not file_path or not os.path.exists(file_path):
            return Response({"error": "File not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        try:
            import pandas as pd
            import pickle
            import math
            df = pd.read_csv(file_path)

            # Preprocess
            prep_results = preprocess_data(df, target_col)
            X = prep_results['X']
            y = prep_results['y']
            problem_type = prep_results['problem_type']
            features = prep_results['features']

            # Train
            models, X_test, y_test = train_models(X, y, problem_type)

            # Evaluate with feature importance computation
            eval_results = evaluate_models(models, X_test, y_test, problem_type, features=features)
            best_model = eval_results['best_model']
            if best_model is None:
                return Response(
                    {"error": "Could not train any model on this dataset. Please ensure the target column and features have sufficient valid data."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            best_score = eval_results['best_score']
            if best_score == -float('inf') or (isinstance(best_score, float) and (math.isnan(best_score) or math.isinf(best_score))):
                best_score = 0.0

            # Assemble complete inference bundle (model + fitted preprocessors + schemas)
            model_bundle = {
                "model": best_model,
                "model_name": eval_results['best_model_name'],
                "problem_type": problem_type,
                "target_col": target_col,
                "target_classes": prep_results.get('target_classes', []),
                "features": features,
                "numeric_cols": prep_results.get('numeric_cols', []),
                "categorical_cols": prep_results.get('categorical_cols', []),
                "encoders": prep_results.get('encoders', {}),
                "categorical_options": prep_results.get('categorical_options', {}),
                "feature_ranges": prep_results.get('feature_ranges', {}),
                "schema_info": prep_results.get('schema_info', []),
                "num_imputer": prep_results.get('num_imputer'),
                "cat_imputer": prep_results.get('cat_imputer'),
                "scaler": prep_results.get('scaler'),
                "feature_importance": eval_results.get('feature_importance', []),
                "metrics": eval_results['all_results'],
                "score": best_score
            }

            # Save model .pkl to disk
            dataset_stem = os.path.basename(dataset.file.name).rsplit('.', 1)[0]
            model_filename = f"model_{dataset.id}_{dataset_stem}.pkl"
            saved_path = save_model(model_bundle, model_filename)

            # Serialize model bundle to bytes for database persistence across ephemeral restarts
            model_bytes = None
            try:
                model_bytes = pickle.dumps(model_bundle)
            except Exception:
                pass

            metrics_payload = {
                "all_results": eval_results['all_results'],
                "feature_importance": eval_results.get('feature_importance', []),
                "schema_info": prep_results.get('schema_info', []),
                "problem_type": problem_type,
                "target_column": target_col,
                "target_classes": prep_results.get('target_classes', []),
                "features": features,
            }

            model_record = ModelRecord.objects.create(
                user=request.user,
                dataset=dataset,
                model_name=eval_results['best_model_name'],
                accuracy=best_score,
                metrics=metrics_payload,
                file=saved_path,
                binary_data=model_bytes,
            )

            return Response({
                "model_id": model_record.id,
                "best_model": eval_results['best_model_name'],
                "score": best_score,
                "metrics": eval_results['all_results'],
                "feature_importance": eval_results.get('feature_importance', []),
                "schema_info": prep_results.get('schema_info', []),
                "features": features,
                "problem_type": problem_type,
                "target_column": target_col,
                "target_classes": prep_results.get('target_classes', []),
                "model_download_url": f"/api/download-model?model_id={model_record.id}",
            }, status=status.HTTP_200_OK)

        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ──────────────────────────────────────────────────────────────────────────────
# Live Prediction Playground ("What-If" Simulator)
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
        model_id = request.data.get('model_id')
        inputs = request.data.get('inputs', {})

        if not model_id:
            return Response({"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response({"error": "Model not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        bundle = None
        # Try loading bundle from disk
        if model_record.file and os.path.exists(model_record.file.path):
            try:
                import joblib
                bundle = joblib.load(model_record.file.path)
            except Exception:
                pass

        # Fallback to binary_data in DB
        if bundle is None and model_record.binary_data:
            try:
                import io, joblib
                bundle = joblib.load(io.BytesIO(bytes(model_record.binary_data)))
            except Exception:
                pass
            if bundle is None:
                try:
                    import pickle
                    bundle = pickle.loads(model_record.binary_data)
                except Exception:
                    pass

        if bundle is None:
            return Response({"error": "Failed to load model artifact."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # If legacy raw model rather than dictionary bundle, wrap it
        if not isinstance(bundle, dict):
            model_obj = bundle
            fitted_features = getattr(model_obj, 'feature_names_in_', None)
            if fitted_features is not None:
                features = [str(f) for f in fitted_features]
            else:
                features = [str(f) for f in (model_record.metrics or {}).get('features', [])]
            
            target_col = (model_record.metrics or {}).get('target_column')
            if not features:
                features = [str(k) for k in inputs.keys() if k != target_col]
            elif target_col and target_col in features:
                features = [f for f in features if f != target_col]

            problem_type = (model_record.metrics or {}).get('problem_type', 'classification')
            bundle = {
                "model": model_obj,
                "features": features,
                "problem_type": problem_type,
                "numeric_cols": features,
                "categorical_cols": [],
                "encoders": {},
                "scaler": None,
                "target_col": target_col
            }
        else:
            # Bundle is dict: guarantee features strictly excludes target column
            model_obj = bundle.get('model')
            fitted_features = getattr(model_obj, 'feature_names_in_', None)
            if fitted_features is not None:
                bundle['features'] = [str(f) for f in fitted_features]
            target_col = bundle.get('target_col') or (model_record.metrics or {}).get('target_column')
            if target_col and target_col in bundle.get('features', []):
                bundle['features'] = [f for f in bundle['features'] if f != target_col]

        try:
            result = predict_with_bundle(bundle, inputs)
            result["model_id"] = model_record.id
            result["model_name"] = model_record.model_name
            result["target_column"] = bundle.get('target_col') or (model_record.metrics or {}).get('target_column', 'Prediction')

            # Top driver explanation
            feat_imp = (model_record.metrics or {}).get('feature_importance', [])
            if feat_imp:
                top_feats = [item['feature'] for item in feat_imp[:3] if item.get('feature') in inputs]
                if top_feats:
                    result["explanation"] = f"Key predictors '{', '.join(top_feats)}' significantly influenced this outcome."

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Prediction failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class ModelSchemaView(APIView):
    """
    GET /api/model-schema?model_id=<id>
    Returns input features schema, min/max ranges, and feature importance for What-If simulator.
    Strictly excludes the target column from schema_info to prevent model fit mismatch errors.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get('model_id')
        if not model_id:
            return Response({"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response({"error": "Model not found."}, status=status.HTTP_404_NOT_FOUND)

        metrics = model_record.metrics or {}
        schema_info = metrics.get('schema_info', [])
        features = list(metrics.get('features', []))
        feature_importance = metrics.get('feature_importance', [])
        problem_type = metrics.get('problem_type', 'classification')
        target_column = metrics.get('target_column', '')
        target_classes = metrics.get('target_classes', [])

        # Load underlying model object to inspect ground truth fitted feature names
        model_obj = None
        if model_record.file and os.path.exists(model_record.file.path):
            try:
                import joblib
                loaded = joblib.load(model_record.file.path)
                model_obj = loaded['model'] if isinstance(loaded, dict) else loaded
            except Exception:
                pass
        if model_obj is None and model_record.binary_data:
            try:
                import io, joblib
                loaded = joblib.load(io.BytesIO(bytes(model_record.binary_data)))
                model_obj = loaded['model'] if isinstance(loaded, dict) else loaded
            except Exception:
                pass

        # If model has feature_names_in_, it is the absolute ground truth of features
        if model_obj is not None and hasattr(model_obj, 'feature_names_in_'):
            features = [str(f) for f in model_obj.feature_names_in_]

        # Auto-deduce target_column if not explicitly recorded in metrics
        if not target_column and model_record.dataset:
            dataset = model_record.dataset
            cols = list((dataset.metadata or {}).get('columns', []))
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
                    feat_list = [c for c in cols if c != target_column] if cols else features
                    n_in = getattr(model_obj, "n_features_in_", len(feat_list))
                    if len(feat_list) >= n_in:
                        feat_list = feat_list[:n_in]
                    feature_importance = calculate_feature_importance(model_obj, feat_list, problem_type)
            except Exception:
                pass
            if not feature_importance and model_record.dataset and model_record.dataset.metadata:
                eda_rep = model_record.dataset.metadata.get("eda_report", {})
                corr_list = eda_rep.get("correlation", [])
                if isinstance(corr_list, list) and corr_list:
                    scores = {}
                    for item in corr_list:
                        if isinstance(item, dict):
                            x, y, val = item.get("x"), item.get("y"), abs(item.get("value", 0.0) or 0.0)
                            if x and y and x != y and x != target_column and y != target_column:
                                scores[x] = scores.get(x, 0.0) + val
                    if scores:
                        tot = sum(scores.values()) or 1.0
                        feature_importance = [
                            {"feature": str(k), "importance": round((v / tot) * 100, 2), "raw_score": round(v, 4)}
                            for k, v in sorted(scores.items(), key=lambda x: x[1], reverse=True)
                        ]

        # Sanitize existing schema_info so target_column is NEVER present as an input
        if schema_info:
            schema_info = [
                f for f in schema_info 
                if f.get('name') != target_column and (not features or f.get('name') in features)
            ]

        # Synthesize schema_info if absent
        if not schema_info:
            dataset = model_record.dataset
            ensure_dataset_file_on_disk(dataset)
            if dataset.file and os.path.exists(dataset.file.path):
                import pandas as pd
                df = pd.read_csv(dataset.file.path)
                schema_info = []
                allowed_cols = features if features else [c for c in df.columns if c != target_column]
                for col in allowed_cols:
                    if col not in df.columns or col == target_column:
                        continue
                    if pd.api.types.is_numeric_dtype(df[col]):
                        c_min = float(df[col].min()) if not pd.isna(df[col].min()) else 0.0
                        c_max = float(df[col].max()) if not pd.isna(df[col].max()) else 100.0
                        c_med = float(df[col].median()) if not pd.isna(df[col].median()) else 0.0
                        diff = c_max - c_min
                        step = 1.0 if diff > 50 and isinstance(c_min, int) else (round(diff / 100.0, 3) if diff > 0 else 0.1)
                        schema_info.append({
                            "name": col,
                            "type": "numeric",
                            "min": round(c_min, 2),
                            "max": round(c_max, 2),
                            "mean": round(float(df[col].mean()), 2),
                            "median": round(c_med, 2),
                            "step": step if step > 0 else 0.1,
                            "default": round(c_med, 2)
                        })
                    else:
                        opts = [str(x) for x in df[col].dropna().unique()[:30]]
                        schema_info.append({
                            "name": col,
                            "type": "categorical",
                            "options": opts,
                            "default": opts[0] if opts else ""
                        })

        return Response({
            "model_id": model_record.id,
            "model_name": model_record.model_name,
            "score": model_record.accuracy,
            "problem_type": problem_type,
            "target_column": target_column,
            "target_classes": target_classes,
            "schema_info": schema_info,
            "features": features,
            "feature_importance": feature_importance
        }, status=status.HTTP_200_OK)


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
        dataset_id = request.query_params.get('dataset_id')
        model_id = request.query_params.get('model_id')
        download = request.query_params.get('download') == '1'

        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response({"error": "Dataset not found."}, status=status.HTTP_404_NOT_FOUND)

        model_record = None
        if model_id:
            model_record = ModelRecord.objects.filter(id=model_id, dataset=dataset, user=request.user).first()
        if not model_record:
            model_record = ModelRecord.objects.filter(dataset=dataset, user=request.user).order_by('-accuracy').first()

        eda_data = dataset.metadata.get("eda_report") if dataset.metadata else None
        if not eda_data:
            from .utils.eda import perform_eda
            file_path = ensure_dataset_file_on_disk(dataset)
            if file_path and os.path.exists(file_path):
                eda_data = perform_eda(file_path)

        html_content = generate_html_report(dataset, eda_data, model_record)

        response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
        disposition = 'attachment' if download else 'inline'
        safe_name = dataset.name.replace(' ', '_').rsplit('.', 1)[0]
        response['Content-Disposition'] = f'{disposition}; filename="Executive_Report_{safe_name}.html"'
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

        model_id = request.query_params.get('model_id')
        if not model_id:
            return Response({"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response({"error": "Model not found."}, status=status.HTTP_404_NOT_FOUND)

        model_bytes = None
        if model_record.file and os.path.exists(model_record.file.path):
            with open(model_record.file.path, 'rb') as f:
                model_bytes = f.read()
        elif model_record.binary_data:
            model_bytes = bytes(model_record.binary_data)

        if not model_bytes:
            return Response({"error": "Model file content unavailable."}, status=status.HTTP_404_NOT_FOUND)

        metrics = model_record.metrics or {}
        model_name = model_record.model_name
        features = metrics.get('features', [])
        problem_type = metrics.get('problem_type', 'classification')

        sample_input = {feat: 1.0 for feat in features}
        sample_curl_json = json.dumps({"inputs": sample_input}, indent=2)

        app_code = f'''import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union, Dict, Any

# Load model bundle
try:
    bundle = joblib.load("model.pkl")
except Exception:
    import pickle
    with open("model.pkl", "rb") as f:
        bundle = pickle.load(f)

if not isinstance(bundle, dict):
    bundle = {{
        "model": bundle,
        "features": {features!r},
        "problem_type": {problem_type!r},
        "numeric_cols": {features!r},
        "categorical_cols": [],
        "encoders": {{}},
        "scaler": None
    }}

model = bundle["model"]
features = bundle.get("features", {features!r})
problem_type = bundle.get("problem_type", {problem_type!r})
numeric_cols = bundle.get("numeric_cols", [])
categorical_cols = bundle.get("categorical_cols", [])
num_imputer = bundle.get("num_imputer")
cat_imputer = bundle.get("cat_imputer")
label_encoders = bundle.get("encoders", {{}}).get("features", {{}})
target_encoder = bundle.get("encoders", {{}}).get("target")
target_classes = bundle.get("target_classes", [])
scaler = bundle.get("scaler")

app = FastAPI(
    title="{model_name} REST API",
    description="Production-grade ML inference endpoint generated by Autonomous AI Data Scientist",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    inputs: Dict[str, Any]

class PredictResponse(BaseModel):
    prediction: Union[str, float, int]
    problem_type: str
    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None
    model_name: str

@app.get("/")
def index():
    return {{"service": "{model_name} Inference API", "docs": "/docs", "health": "/health"}}

@app.get("/health")
def health():
    return {{
        "status": "healthy",
        "model": "{model_name}",
        "problem_type": problem_type,
        "features": features
    }}

@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        raw = request.inputs
        row = {{}}
        for feat in features:
            v = raw.get(feat)
            if feat in numeric_cols:
                try:
                    row[feat] = float(v) if v is not None and v != "" else np.nan
                except Exception:
                    row[feat] = np.nan
            else:
                row[feat] = str(v) if v is not None else ""

        df_row = pd.DataFrame([row], columns=features)

        if len(numeric_cols) > 0 and num_imputer is not None:
            df_row[numeric_cols] = num_imputer.transform(df_row[numeric_cols])

        if len(categorical_cols) > 0 and cat_imputer is not None:
            df_row[categorical_cols] = cat_imputer.transform(df_row[categorical_cols])

        for col in categorical_cols:
            le = label_encoders.get(col)
            if le is not None:
                val_str = str(df_row[col].iloc[0])
                df_row[col] = le.transform([val_str])[0] if val_str in le.classes_ else 0

        X_vec = scaler.transform(df_row) if scaler is not None else df_row.values
        raw_pred = model.predict(X_vec)[0]

        probabilities = {{}}
        confidence = None

        if problem_type == "classification":
            if target_encoder is not None:
                final_pred = str(target_encoder.inverse_transform([int(raw_pred)])[0])
            elif target_classes and int(raw_pred) < len(target_classes):
                final_pred = str(target_classes[int(raw_pred)])
            else:
                final_pred = str(raw_pred)

            if hasattr(model, 'predict_proba'):
                try:
                    probs = model.predict_proba(X_vec)[0]
                    classes = target_classes if target_classes and len(target_classes) == len(probs) else [str(c) for c in getattr(model, 'classes_', range(len(probs)))]
                    for c_name, p in zip(classes, probs):
                        probabilities[str(c_name)] = round(float(p) * 100.0, 1)
                    confidence = round(float(np.max(probs)) * 100.0, 1)
                except Exception:
                    pass
        else:
            final_pred = round(float(raw_pred), 4)

        return PredictResponse(
            prediction=final_pred,
            problem_type=problem_type,
            confidence=confidence,
            probabilities=probabilities if probabilities else None,
            model_name="{model_name}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
'''

        dockerfile_code = '''FROM python:3.10-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
'''

        reqs_code = '''fastapi>=0.111.0
uvicorn>=0.30.1
pydantic>=2.7.0
scikit-learn>=1.4.0
pandas>=2.2.0
numpy>=1.26.0
joblib>=1.4.0
'''

        readme_code = f'''# {model_name} Production Microservice
Auto-generated by the **Autonomous AI Data Scientist Platform**.

## 🚀 Quickstart

### 1. Run with Docker (Recommended)
```bash
docker build -t ml-service .
docker run -p 8000:8000 ml-service
```
Swagger UI available at `http://localhost:8000/docs`.

### 2. Run Locally
```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## 📡 Sample cURL Request
```bash
curl -X POST http://localhost:8000/predict \\
  -H "Content-Type: application/json" \\
  -d '{sample_curl_json}'
```
'''

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('model.pkl', model_bytes)
            z.writestr('app.py', app_code)
            z.writestr('Dockerfile', dockerfile_code)
            z.writestr('requirements.txt', reqs_code)
            z.writestr('README.md', readme_code)

        zip_buffer.seek(0)
        zip_filename = f"deployment_{model_record.id}_{model_record.model_name.replace(' ', '_')}.zip"

        return FileResponse(
            zip_buffer,
            as_attachment=True,
            filename=zip_filename,
            content_type='application/zip'
        )



class UserModelsView(APIView):
    """
    GET /api/models
    Return a paginated list of all trained models belonging to the authenticated user.
    Optionally filter by ?dataset_id=<id>.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = ModelRecord.objects.filter(user=request.user).select_related('user', 'dataset')

        # Optional filter by dataset
        dataset_id = request.query_params.get('dataset_id')
        if dataset_id:
            qs = qs.filter(dataset_id=dataset_id)

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ModelRecordSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class DownloadModelView(APIView):
    """
    GET /api/download-model?model_id=<id>
    Stream the trained model .pkl file back to the user.
    Falls back gracefully to binary_data stored in PostgreSQL if Render ephemeral disk wiped the file.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        model_id = request.query_params.get('model_id')

        if not model_id:
            return Response({"error": "model_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            model_record = ModelRecord.objects.get(id=model_id, user=request.user)
        except (ModelRecord.DoesNotExist, ValueError):
            return Response(
                {"error": "Model not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        filename = f"model_{model_record.id}.pkl"
        if model_record.file and model_record.file.name:
            filename = os.path.basename(model_record.file.name)

        # 1. Primary: If file exists on local disk, serve it
        if model_record.file and os.path.exists(model_record.file.path):
            return FileResponse(open(model_record.file.path, 'rb'), as_attachment=True, filename=filename)

        # 2. Resilient Fallback: If Render restarted and wiped the ephemeral disk,
        # stream directly from binary_data stored in PostgreSQL!
        if model_record.binary_data:
            import io
            # Recreate on disk for any subsequent reads
            try:
                if model_record.file:
                    os.makedirs(os.path.dirname(model_record.file.path), exist_ok=True)
                    with open(model_record.file.path, 'wb') as f:
                        f.write(model_record.binary_data)
            except Exception:
                pass
            return FileResponse(io.BytesIO(model_record.binary_data), as_attachment=True, filename=filename)

        return Response({"error": "Model file missing on disk."}, status=status.HTTP_404_NOT_FOUND)


class DownloadDatasetView(APIView):
    """
    GET /api/download-dataset?dataset_id=<id>
    Stream dataset CSV file with authentication and persistent DB fallback.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')
        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response({"error": "Dataset not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        filename = dataset.name if dataset.name.endswith('.csv') else f"{dataset.name}.csv"
        file_path = ensure_dataset_file_on_disk(dataset)

        if file_path and os.path.exists(file_path):
            return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=filename)

        if dataset.csv_data:
            import io
            return FileResponse(io.BytesIO(dataset.csv_data.encode('utf-8')), as_attachment=True, filename=filename)

        return Response({"error": "Dataset file missing on disk."}, status=status.HTTP_404_NOT_FOUND)



# ──────────────────────────────────────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────────────────────────────────────

class ChatView(APIView):
    """
    POST /api/chat  — Submit a question about the dataset.
    GET  /api/chat  — Retrieve chat history for a dataset.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from .agent.workflow import process_chat_query
        dataset_id = request.data.get('dataset_id')
        question = request.data.get('question')

        if not dataset_id or not question:
            return Response(
                {"error": "dataset_id and question are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve prior chat context (last 5 exchanges)
        previous_chats = ChatHistory.objects.filter(
            dataset=dataset, user=request.user
        ).order_by('-created_at')[:5]
        history = [{"question": c.question, "answer": c.answer} for c in reversed(previous_chats)]

        # Run AI workflow
        answer = process_chat_query(dataset.id, question, history)

        # Persist exchange
        record = ChatHistory.objects.create(
            user=request.user,
            dataset=dataset,
            question=question,
            answer=answer,
        )

        return Response(
            {"answer": answer, "created_at": record.created_at},
            status=status.HTTP_200_OK
        )

    def get(self, request, *args, **kwargs):
        dataset_id = request.query_params.get('dataset_id')
        if not dataset_id:
            return Response({"error": "dataset_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        except (Dataset.DoesNotExist, ValueError):
            return Response(
                {"error": "Dataset not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        chats = ChatHistory.objects.filter(dataset=dataset, user=request.user)
        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(chats, request)
        serializer = ChatHistorySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
