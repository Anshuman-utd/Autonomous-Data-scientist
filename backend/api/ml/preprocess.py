import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import LabelEncoder, StandardScaler

def detect_problem_type(df, target_col):
    """
    Detects if the problem is classification or regression based on target column type.
    """
    # If the target is object/categorical, or integer with few unique values -> Classification
    if pd.api.types.is_object_dtype(df[target_col]) or pd.api.types.is_categorical_dtype(df[target_col]):
        return "classification"
    
    unique_count = df[target_col].nunique()
    if pd.api.types.is_integer_dtype(df[target_col]) and unique_count < 20: 
        # Heuristic: less than 20 distinct integers might be classification
        return "classification"
        
    return "regression"

def preprocess_data(df, target_col=None):
    """
    Preprocesses the dataframe by handling missing values, encoding categoricals,
    and separating features (X) and target (y).
    """
    if target_col is None:
        target_col = df.columns[-1]
        
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in the dataset.")
        
    problem_type = detect_problem_type(df, target_col)
    
    # Separation X and y
    X = df.drop(columns=[target_col]).copy()
    y = df[target_col].copy()
    
    X_processed = X.copy()
    
    # 1. Identify Numerical and Categorical columns in X
    numeric_cols = X_processed.select_dtypes(include=['int64', 'float64']).columns
    categorical_cols = X_processed.select_dtypes(include=['object', 'category', 'bool']).columns
    
    # 2. Handle missing values
    if len(numeric_cols) > 0:
        num_imputer = SimpleImputer(strategy='mean')
        X_processed[numeric_cols] = num_imputer.fit_transform(X_processed[numeric_cols])
        
    if len(categorical_cols) > 0:
        cat_imputer = SimpleImputer(strategy='most_frequent')
        X_processed[categorical_cols] = cat_imputer.fit_transform(X_processed[categorical_cols])
        
    # 3. Encode categorical columns in X
    # Using LabelEncoder for simplicity, but strictly OneHot is better for non-ordinal.
    # Label encoding is easier for tree-based models which we are using.
    label_encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        X_processed[col] = le.fit_transform(X_processed[col].astype(str))
        label_encoders[col] = le
        
    # 4. Handle target column y
    # If classification and y is string/object, encode it
    target_encoder = None
    if problem_type == "classification" and (pd.api.types.is_object_dtype(y) or pd.api.types.is_categorical_dtype(y)):
        target_encoder = LabelEncoder()
        y = target_encoder.fit_transform(y.astype(str))
    else:
        # Impute y if it has missing values (rare but possible)
        if y.isnull().any():
            if problem_type == "regression":
                y = y.fillna(y.mean())
            else:
                y = y.fillna(y.mode()[0])
                
    # 5. Optionally Scale Features for Logistic/Linear Regression
    # Tree models don't need scaling, but linear ones do. We will scale.
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X_processed), columns=X_processed.columns)
    
    return {
        'X': X_scaled,
        'y': y,
        'features': list(X_scaled.columns),
        'problem_type': problem_type,
        'encoders': {
            'features': label_encoders,
            'target': target_encoder
        },
        'scaler': scaler
    }
