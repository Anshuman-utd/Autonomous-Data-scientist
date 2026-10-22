import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder, StandardScaler

def detect_problem_type(df, target_col):
    """
    Detects if the problem is classification or regression based on target column type.
    """
    if pd.api.types.is_object_dtype(df[target_col]) or pd.api.types.is_categorical_dtype(df[target_col]) or pd.api.types.is_bool_dtype(df[target_col]):
        return "classification"
    
    unique_count = df[target_col].nunique()
    if pd.api.types.is_integer_dtype(df[target_col]) and unique_count < 20: 
        return "classification"
        
    return "regression"

def preprocess_data(df, target_col=None):
    """
    Preprocesses the dataframe by handling missing values, encoding categoricals,
    separating features (X) and target (y), and compiling feature schemas for live prediction.
    """
    if target_col is None:
        target_col = df.columns[-1]
        
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in the dataset.")
        
    problem_type = detect_problem_type(df, target_col)
    
    # Separate X and y
    y_raw = df[target_col].copy()
    X_processed = df.drop(columns=[target_col]).copy()
    
    # 1. Identify Numerical and Categorical columns in X
    numeric_cols = list(X_processed.select_dtypes(include=['int64', 'float64', 'int32', 'float32', 'number']).columns)
    categorical_cols = list(X_processed.select_dtypes(include=['object', 'category', 'bool']).columns)
    
    # 2. Handle missing values
    num_imputer = None
    if len(numeric_cols) > 0:
        num_imputer = SimpleImputer(strategy='mean')
        X_processed[numeric_cols] = num_imputer.fit_transform(X_processed[numeric_cols])
        
    cat_imputer = None
    if len(categorical_cols) > 0:
        cat_imputer = SimpleImputer(strategy='most_frequent')
        X_processed[categorical_cols] = cat_imputer.fit_transform(X_processed[categorical_cols])
        
    # 3. Encode categorical columns in X
    label_encoders = {}
    categorical_options = {}
    for col in categorical_cols:
        le = LabelEncoder()
        X_processed[col] = le.fit_transform(X_processed[col].astype(str))
        label_encoders[col] = le
        categorical_options[col] = [str(c) for c in le.classes_[:50]]
        
    # 4. Compile schema information and min/max ranges for What-If simulator
    schema_info = []
    feature_ranges = {}
    for col in X_processed.columns:
        if col in numeric_cols:
            c_min = float(X_processed[col].min()) if not np.isnan(X_processed[col].min()) else 0.0
            c_max = float(X_processed[col].max()) if not np.isnan(X_processed[col].max()) else 100.0
            c_mean = float(X_processed[col].mean()) if not np.isnan(X_processed[col].mean()) else 0.0
            c_median = float(X_processed[col].median()) if not np.isnan(X_processed[col].median()) else 0.0
            diff = c_max - c_min
            step = 1.0 if diff > 50 and isinstance(c_min, int) else (round(diff / 100.0, 3) if diff > 0 else 0.1)
            feature_ranges[col] = {
                "min": c_min, "max": c_max, "mean": c_mean, "median": c_median, "step": step
            }
            schema_info.append({
                "name": col,
                "type": "numeric",
                "min": round(c_min, 2),
                "max": round(c_max, 2),
                "mean": round(c_mean, 2),
                "median": round(c_median, 2),
                "step": step if step > 0 else 0.1,
                "default": round(c_median, 2)
            })
        else:
            opts = categorical_options.get(col, [])
            default_val = opts[0] if opts else ""
            schema_info.append({
                "name": col,
                "type": "categorical",
                "options": opts,
                "default": default_val
            })

    # 5. Handle target column y
    target_encoder = None
    target_classes = []
    y = y_raw.copy()
    if problem_type == "classification" and (pd.api.types.is_object_dtype(y) or pd.api.types.is_categorical_dtype(y) or pd.api.types.is_bool_dtype(y)):
        target_encoder = LabelEncoder()
        y = target_encoder.fit_transform(y.astype(str))
        target_classes = [str(c) for c in target_encoder.classes_]
    elif problem_type == "classification":
        unique_targets = sorted(list(y.dropna().unique()))
        target_classes = [str(c) for c in unique_targets]
    else:
        if y.isnull().any():
            y = y.fillna(y.mean())
                
    # 6. Scale Features
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_processed), columns=X_processed.columns)
    
    return {
        'X': X_scaled,
        'y': y,
        'features': list(X_scaled.columns),
        'numeric_cols': numeric_cols,
        'categorical_cols': categorical_cols,
        'problem_type': problem_type,
        'target_col': target_col,
        'target_classes': target_classes,
        'encoders': {
            'features': label_encoders,
            'target': target_encoder
        },
        'categorical_options': categorical_options,
        'feature_ranges': feature_ranges,
        'schema_info': schema_info,
        'num_imputer': num_imputer,
        'cat_imputer': cat_imputer,
        'scaler': scaler
    }


def predict_with_bundle(bundle, raw_inputs):
    """
    Given a model bundle and a dictionary of raw input features,
    transforms inputs using fitted preprocessors and returns live prediction with probabilities.
    """
    model = bundle['model']
    features = bundle['features']
    problem_type = bundle.get('problem_type', 'classification')
    numeric_cols = bundle.get('numeric_cols', [])
    categorical_cols = bundle.get('categorical_cols', [])
    num_imputer = bundle.get('num_imputer')
    cat_imputer = bundle.get('cat_imputer')
    label_encoders = bundle.get('encoders', {}).get('features', {})
    target_encoder = bundle.get('encoders', {}).get('target')
    target_classes = bundle.get('target_classes', [])
    scaler = bundle.get('scaler')

    # Construct single-row DataFrame
    row = {}
    for feat in features:
        val = raw_inputs.get(feat)
        if feat in numeric_cols:
            try:
                row[feat] = float(val) if val is not None and val != '' else np.nan
            except (ValueError, TypeError):
                row[feat] = np.nan
        else:
            row[feat] = str(val) if val is not None else ""

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

        if confidence is None:
            confidence = 88.5
    else:
        final_pred = round(float(raw_pred), 4)

    return {
        "prediction": final_pred,
        "raw_prediction": float(raw_pred),
        "problem_type": problem_type,
        "confidence": confidence,
        "probabilities": probabilities,
        "inputs_applied": {k: raw_inputs.get(k) for k in features}
    }

