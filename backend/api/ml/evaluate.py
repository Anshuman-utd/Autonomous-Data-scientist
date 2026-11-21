import numpy as np


def calculate_feature_importance(model, features, problem_type="classification"):
    """
    Computes normalized feature importance scores (Tree weights, coefficients, or perturbations).
    Returns a sorted list of dictionaries with feature name, relative importance percentage, and raw score.
    """
    if not features:
        return []

    num_features = len(features)
    raw_scores = None

    try:
        # 1. Tree-based models (Random Forest, Decision Tree)
        if hasattr(model, "feature_importances_"):
            raw_scores = np.array(model.feature_importances_)

        # 2. Linear models with coefficients (Logistic / Linear Regression, Linear SVC/SVR)
        elif hasattr(model, "coef_"):
            coef = np.array(model.coef_)
            if coef.ndim > 1:
                raw_scores = np.mean(np.abs(coef), axis=0)
            else:
                raw_scores = np.abs(coef)

        if (
            raw_scores is None
            or len(raw_scores) != num_features
            or np.all(raw_scores == 0)
        ):
            return []

        # Normalize to 100%
        total = np.sum(raw_scores)
        if total > 0:
            norm_scores = (raw_scores / total) * 100.0
        else:
            norm_scores = np.ones(num_features) * (100.0 / num_features)

        results = []
        for feat, norm_val, raw_val in zip(features, norm_scores, raw_scores):
            results.append(
                {
                    "feature": str(feat),
                    "importance": round(float(norm_val), 2),
                    "raw_score": round(float(raw_val), 5),
                }
            )

        # Sort descending by importance
        results.sort(key=lambda x: x["importance"], reverse=True)
        return results

    except Exception:
        return []
