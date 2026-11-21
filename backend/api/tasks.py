from celery import shared_task


@shared_task(bind=True)
def train_model_async_task(self, dataset_id, user_id, target_col, version_id=None):
    from .ml.experiments import run_experiment

    record = run_experiment(dataset_id, user_id, target_col, version_id=version_id)
    return {"status": "SUCCESS", "model_id": record.pk}
