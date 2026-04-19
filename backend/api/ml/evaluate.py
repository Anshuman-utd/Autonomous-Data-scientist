import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, r2_score, mean_squared_error

def evaluate_models(models, X_test, y_test, problem_type):
    """
    Evaluates models and returns metrics alongside the best model.
    """
    results = {}
    best_model_name = None
    best_model = None
    best_score = -float('inf') if problem_type == "classification" else float('inf') # Wait, R2 score higher is better. So max for both accuracy and R2.
    best_score = -float('inf') 
    
    for name, model in models.items():
        y_pred = model.predict(X_test)
        
        if problem_type == "classification":
            acc = float(accuracy_score(y_test, y_pred))
            results[name] = {
                "score": acc,
                "score_name": "Accuracy",
                "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
            }
            if acc > best_score:
                best_score = acc
                best_model_name = name
                best_model = model
                
        elif problem_type == "regression":
            r2 = float(r2_score(y_test, y_pred))
            rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
            
            results[name] = {
                "score": r2,
                "score_name": "R² Score",
                "rmse": rmse
            }
            
            if r2 > best_score: # Higher R2 is better
                best_score = r2
                best_model_name = name
                best_model = model

    return {
        "best_model_name": best_model_name,
        "best_model": best_model,
        "best_score": best_score,
        "all_results": results
    }
