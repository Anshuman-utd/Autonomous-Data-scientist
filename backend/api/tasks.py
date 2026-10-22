import os
import pickle
import logging
from celery import shared_task
from django.core.cache import cache
from .models import Dataset, ModelRecord

logger = logging.getLogger(__name__)

@shared_task(bind=True)
def train_model_async_task(self, dataset_id, user_id, target_col):
    """
    Celery background worker task for autonomous model training.
    """
    from .ml.train import train_models
    from .ml.evaluate import evaluate_models
    from .ml.preprocess import preprocess_data
    from .ml.save_model import save_model
    from .utils.file_handler import ensure_dataset_file_on_disk
    from django.contrib.auth.models import User
    import pandas as pd

    try:
        user = User.objects.get(id=user_id)
        dataset = Dataset.objects.get(id=dataset_id, user=user)
        file_path = ensure_dataset_file_on_disk(dataset)
        df = pd.read_csv(file_path)

        prep_results = preprocess_data(df, target_col)
        X = prep_results['X']
        y = prep_results['y']
        problem_type = prep_results['problem_type']
        features = prep_results['features']

        models, X_test, y_test = train_models(X, y, problem_type)
        eval_results = evaluate_models(models, X_test, y_test, problem_type, features=features)
        best_model = eval_results['best_model']

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
            "metrics": eval_results.get('all_results', {}),
            "score": eval_results.get('best_score')
        }

        dataset_stem = os.path.basename(dataset.file.name).rsplit('.', 1)[0]
        model_filename = f"model_{dataset.id}_{dataset_stem}.pkl"
        saved_path = save_model(model_bundle, model_filename)

        model_bytes = pickle.dumps(model_bundle)

        record = ModelRecord.objects.create(
            user=user,
            dataset=dataset,
            model_name=eval_results['best_model_name'],
            accuracy=eval_results['best_score'],
            metrics={
                "all_results": eval_results['all_results'],
                "feature_importance": eval_results.get('feature_importance', []),
                "schema_info": prep_results.get('schema_info', []),
                "problem_type": problem_type,
                "target_column": target_col,
                "target_classes": prep_results.get('target_classes', [])
            },
            file=saved_path,
            binary_data=model_bytes
        )

        return {"status": "SUCCESS", "model_id": record.id}

    except Exception as e:
        logger.exception("Failed in train_model_async_task: %s", str(e))
        return {"status": "FAILURE", "error": str(e)}
