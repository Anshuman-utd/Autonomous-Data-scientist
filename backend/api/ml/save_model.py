import joblib
import os
from django.conf import settings

def save_model(model, filename="model.pkl"):
    """
    Saves the trained model to the designated path.
    By default, saves it in the backend/model_store directory or media.
    Let's save it to media/models to keep it accessible or managed.
    """
    models_dir = os.path.join(settings.MEDIA_ROOT, 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    file_path = os.path.join(models_dir, filename)
    joblib.dump(model, file_path)
    
    # Return a relative path or url path for downloads
    return os.path.join('models', filename)
