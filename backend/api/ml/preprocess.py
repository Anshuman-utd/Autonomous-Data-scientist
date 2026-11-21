import pandas as pd
import numpy as np


def detect_problem_type(df, target_col):
    """
    Detects if the problem is classification or regression based on target column type.
    """
    if (
        pd.api.types.is_object_dtype(df[target_col])
        or pd.api.types.is_categorical_dtype(df[target_col])
        or pd.api.types.is_bool_dtype(df[target_col])
    ):
        return "classification"

    unique_count = df[target_col].nunique()
    if pd.api.types.is_integer_dtype(df[target_col]) and unique_count < 20:
        return "classification"

    return "regression"


def predict_with_bundle(bundle, raw_inputs):
    """
    Given a model bundle and a dictionary of raw input features,
    transforms inputs using fitted preprocessors and returns live prediction with probabilities.
    Guarantees strict alignment with model.feature_names_in_ to prevent unseen target column errors.
    """
    model = bundle["model"]
    if bundle.get("format_version") == 2:
        features = bundle["features"]
        if not isinstance(raw_inputs, dict) or set(raw_inputs) != set(features):
            raise ValueError("Provide exactly the input fields required by this model.")
        row = {}
        for feat in features:
            value = raw_inputs[feat]
            if feat in bundle["numeric_cols"]:
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    raise ValueError(f"{feat} must be a number.")
                if not np.isfinite(value):
                    raise ValueError(f"{feat} must be a finite number.")
            else:
                if not isinstance(value, (str, int, float, bool)):
                    raise ValueError(f"{feat} must be a category.")
                value = str(value)
            row[feat] = value
        frame = pd.DataFrame([row], columns=features)
        prediction = model.predict(frame)[0]
        classification = bundle["problem_type"] == "classification"
        probabilities, confidence = {}, None
        if classification and hasattr(model, "predict_proba"):
            probs = model.predict_proba(frame)[0]
            probabilities = {
                str(c): round(float(p) * 100, 2) for c, p in zip(model.classes_, probs)
            }
            confidence = round(float(max(probs)) * 100, 2)
        return {
            "prediction": str(prediction) if classification else float(prediction),
            "problem_type": bundle["problem_type"],
            "confidence": confidence,
            "probabilities": probabilities,
            "inputs_applied": row,
        }

    problem_type = bundle.get("problem_type", "classification")
    numeric_cols = bundle.get("numeric_cols", [])
    categorical_cols = bundle.get("categorical_cols", [])
    num_imputer = bundle.get("num_imputer")
    cat_imputer = bundle.get("cat_imputer")
    label_encoders = bundle.get("encoders", {}).get("features", {})
    target_encoder = bundle.get("encoders", {}).get("target")
    target_classes = bundle.get("target_classes", [])
    scaler = bundle.get("scaler")

    # Resolve true feature list: model.feature_names_in_ is the single source of truth
    fitted_features = getattr(model, "feature_names_in_", None)
    if fitted_features is not None:
        features = [str(f) for f in fitted_features]
    else:
        features = [str(f) for f in bundle.get("features", [])]

    # Explicitly exclude target column if it leaked into features
    target_col = bundle.get("target_col") or bundle.get("target_column")
    if target_col and target_col in features:
        features = [f for f in features if f != target_col]

    # Construct single-row DataFrame strictly containing features
    row = {}
    for feat in features:
        val = raw_inputs.get(feat)
        if feat in numeric_cols or (
            not categorical_cols and isinstance(val, (int, float))
        ):
            try:
                row[feat] = (
                    float(val) if val is not None and str(val).strip() != "" else 0.0
                )
            except (ValueError, TypeError):
                row[feat] = 0.0
        else:
            row[feat] = str(val) if val is not None and str(val).strip() != "" else ""

    df_row = pd.DataFrame([row], columns=features)

    # Impute numeric
    if len(numeric_cols) > 0 and num_imputer is not None:
        try:
            df_row[numeric_cols] = num_imputer.transform(df_row[numeric_cols])
        except Exception:
            pass

    # Impute categorical
    if len(categorical_cols) > 0 and cat_imputer is not None:
        try:
            df_row[categorical_cols] = cat_imputer.transform(df_row[categorical_cols])
        except Exception:
            pass

    # Encode categoricals with fallback for unseen classes
    for col in categorical_cols:
        le = label_encoders.get(col)
        if le is not None:
            val_str = str(df_row[col].iloc[0])
            if val_str in le.classes_:
                df_row[col] = le.transform([val_str])[0]
            else:
                df_row[col] = 0

    # Scale features as DataFrame with feature names
    if scaler is not None:
        X_vec = pd.DataFrame(scaler.transform(df_row), columns=features)
    else:
        X_vec = df_row

    # Predict
    raw_pred = model.predict(X_vec)[0]

    probabilities = {}
    confidence = None

    if problem_type == "classification":
        if target_encoder is not None:
            try:
                final_pred = target_encoder.inverse_transform([int(raw_pred)])[0]
            except Exception:
                final_pred = str(raw_pred)
        else:
            final_pred = str(raw_pred)

        if hasattr(model, "predict_proba"):
            try:
                probs = model.predict_proba(X_vec)[0]
                classes = (
                    target_classes
                    if target_classes and len(target_classes) == len(probs)
                    else [str(c) for c in getattr(model, "classes_", range(len(probs)))]
                )
                for c_name, p in zip(classes, probs):
                    probabilities[str(c_name)] = round(float(p) * 100.0, 1)
                confidence = round(float(np.max(probs)) * 100.0, 1)
            except Exception:
                pass

    else:
        final_pred = round(float(raw_pred), 4)

    return {
        "prediction": final_pred,
        "raw_prediction": raw_pred.item() if hasattr(raw_pred, "item") else raw_pred,
        "problem_type": problem_type,
        "confidence": confidence,
        "probabilities": probabilities,
        "inputs_applied": {k: raw_inputs.get(k) for k in features},
    }
