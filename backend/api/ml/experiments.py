"""Holdout evaluation: all learned feature transforms live inside each pipeline."""

import io
import pickle
import time
import uuid
import numpy as np
import pandas as pd
from django.db import transaction
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC, SVR, LinearSVC, LinearSVR
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    r2_score,
    mean_squared_error,
    mean_absolute_error,
)
from .preprocess import detect_problem_type
from .save_model import save_model
from ..models import Dataset, ModelRecord
from ..versions import ensure_original


def fit_experiment(df, target, task=None):
    if target not in df.columns:
        raise ValueError("Select a valid target column.")
    if task not in (None, "auto", "classification", "regression"):
        raise ValueError("Task must be auto, classification or regression.")
    missing_targets = int(df[target].isna().sum())
    df = df.dropna(subset=[target]).copy()
    if len(df) < 10 or len(df.columns) < 2:
        raise ValueError(
            "Training needs at least 10 rows with a known target and one feature."
        )
    if len(df) > 25000:
        raise ValueError(
            "Interactive training is limited to 25,000 rows. Upload a representative subset."
        )
    problem = (
        task
        if task in ("classification", "regression")
        else detect_problem_type(df, target)
    )
    X, y = df.drop(columns=[target]), df[target]
    numeric = list(X.select_dtypes(include="number").columns)
    categorical = [c for c in X.columns if c not in numeric]
    if any(X[c].nunique() > 100 for c in categorical):
        raise ValueError(
            "Categorical features support up to 100 distinct values. Remove identifiers or high-cardinality text before training."
        )
    for col in categorical:
        X[col] = X[col].map(lambda value: str(value) if pd.notna(value) else np.nan)
    stratify = None
    if problem == "classification":
        y = y.astype(str)
        counts = y.value_counts()
        if len(counts) > 100:
            raise ValueError("Classification supports at most 100 target classes.")
        if len(counts) < 2 or counts.min() < 2:
            raise ValueError(
                "Classification needs at least two classes and two examples per class."
            )
        test_size = max(2, int(np.ceil(len(y) * 0.2)), len(counts))
        if test_size >= len(y) - len(counts):
            raise ValueError(
                "There are too few rows per class for a reliable stratified holdout."
            )
        stratify = y
    else:
        if not pd.api.types.is_numeric_dtype(y):
            raise ValueError("Regression requires a numeric target.")
        if y.nunique() < 2:
            raise ValueError("Regression requires a target with observed variation.")
        test_size = max(2, int(np.ceil(len(y) * 0.2)))
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )
    encoded_features = len(numeric) + sum(X_train[c].nunique() + 1 for c in categorical)
    if encoded_features > 512 or encoded_features * len(X) > 5000000:
        raise ValueError(
            "These features exceed the interactive training memory budget. Remove high-cardinality or redundant features."
        )
    transforms = []
    if numeric:
        transforms.append(
            (
                "numeric",
                Pipeline(
                    [
                        (
                            "impute",
                            SimpleImputer(strategy="median", keep_empty_features=True),
                        ),
                        ("scale", StandardScaler()),
                    ]
                ),
                numeric,
            )
        )
    if categorical:
        transforms.append(
            (
                "categorical",
                Pipeline(
                    [
                        (
                            "impute",
                            SimpleImputer(
                                strategy="most_frequent", keep_empty_features=True
                            ),
                        ),
                        (
                            "encode",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                categorical,
            )
        )
    preprocessing = ColumnTransformer(transforms, verbose_feature_names_out=False)
    estimators = (
        {
            "Logistic regression": LogisticRegression(max_iter=1000, random_state=42),
            "Random forest": RandomForestClassifier(
                n_estimators=80,
                max_depth=12,
                max_leaf_nodes=256,
                n_jobs=1,
                random_state=42,
            ),
            "Decision tree": DecisionTreeClassifier(
                max_depth=12, max_leaf_nodes=256, random_state=42
            ),
            "Support vector machine": (
                SVC(probability=True, max_iter=3000, random_state=42)
                if len(X_train) <= 2000
                else LinearSVC(max_iter=3000, random_state=42)
            ),
            "K-nearest neighbors": KNeighborsClassifier(
                n_neighbors=min(5, len(X_train))
            ),
            "Naive Bayes": GaussianNB(),
        }
        if problem == "classification"
        else {
            "Linear regression": LinearRegression(),
            "Random forest": RandomForestRegressor(
                n_estimators=80,
                max_depth=12,
                max_leaf_nodes=256,
                n_jobs=1,
                random_state=42,
            ),
            "Decision tree": DecisionTreeRegressor(
                max_depth=12, max_leaf_nodes=256, random_state=42
            ),
            "Support vector machine": (
                SVR(max_iter=3000)
                if len(X_train) <= 2000
                else LinearSVR(max_iter=3000, random_state=42)
            ),
            "K-nearest neighbors": KNeighborsRegressor(
                n_neighbors=min(5, len(X_train))
            ),
        }
    )
    results, trained, failures = {}, {}, []
    from sklearn.base import clone

    for name, estimator in estimators.items():
        pipeline = Pipeline(
            [("preprocess", clone(preprocessing)), ("estimator", estimator)]
        )
        try:
            started = time.perf_counter()
            pipeline.fit(X_train, y_train)
            fit_seconds = time.perf_counter() - started
            started = time.perf_counter()
            pred = pipeline.predict(X_test)
            latency = (time.perf_counter() - started) * 1000 / len(X_test)
            if problem == "classification":
                classes = list(pipeline.classes_)
                metrics = {
                    "score": float(accuracy_score(y_test, pred)),
                    "score_name": "Accuracy",
                    "f1_score": float(
                        f1_score(y_test, pred, average="weighted", zero_division=0)
                    ),
                    "precision": float(
                        precision_score(
                            y_test, pred, average="weighted", zero_division=0
                        )
                    ),
                    "recall": float(
                        recall_score(y_test, pred, average="weighted", zero_division=0)
                    ),
                    "confusion_matrix": confusion_matrix(
                        y_test, pred, labels=classes
                    ).tolist(),
                    "classes": classes,
                }
            else:
                metrics = {
                    "score": float(r2_score(y_test, pred)),
                    "score_name": "R²",
                    "rmse": float(np.sqrt(mean_squared_error(y_test, pred))),
                    "mae": float(mean_absolute_error(y_test, pred)),
                }
            metrics.update(
                training_seconds=round(fit_seconds, 4), latency_ms=round(latency, 4)
            )
            if not np.isfinite(metrics["score"]):
                raise ValueError("Undefined evaluation score.")
            results[name], trained[name] = metrics, pipeline
        except (ValueError, TypeError):
            failures.append(name)
    if not results:
        raise ValueError("No model could be fitted to these features and target.")
    best = max(results, key=lambda name: results[name]["score"])
    model = trained[best]
    importance, method = [], None
    estimator = model.named_steps["estimator"]
    names = model.named_steps["preprocess"].get_feature_names_out()
    if hasattr(estimator, "feature_importances_"):
        weights, method = estimator.feature_importances_, "impurity-based importance"
    elif hasattr(estimator, "coef_"):
        weights, method = (
            np.abs(estimator.coef_),
            "absolute coefficients (numeric features standardized)",
        )
        if weights.ndim > 1:
            weights = weights.mean(axis=0)
    else:
        weights = []
    total = float(np.sum(weights))
    if total > 0:
        importance = sorted(
            [
                {
                    "feature": str(name),
                    "importance": round(float(value) / total * 100, 3),
                    "raw_score": float(value),
                }
                for name, value in zip(names, weights)
            ],
            key=lambda item: -item["importance"],
        )
    schema = []
    for col in X_train.columns:
        values = X_train[col].dropna()
        if col in numeric:
            low, high = (
                (float(values.min()), float(values.max()))
                if len(values)
                else (0.0, 0.0)
            )
            schema.append(
                {
                    "name": col,
                    "type": "numeric",
                    "min": low,
                    "max": high,
                    "default": float(values.median()) if len(values) else 0.0,
                    "step": "any",
                }
            )
        else:
            options = sorted(str(v) for v in values.unique())
            schema.append(
                {
                    "name": col,
                    "type": "categorical",
                    "options": options,
                    "default": options[0] if options else "",
                }
            )
    evaluation = {
        "method": "stratified holdout" if stratify is not None else "random holdout",
        "random_seed": 42,
        "training_rows": len(X_train),
        "test_rows": len(X_test),
        "dropped_missing_targets": missing_targets,
        "selection_metric": "accuracy" if problem == "classification" else "r2",
        "selection_note": "Highest score among these candidates on the same holdout; no independent final test or cross-validation.",
    }
    bundle = {
        "format_version": 2,
        "model_name": best,
        "metrics": results,
        "score": results[best]["score"],
        "model": model,
        "features": list(X.columns),
        "numeric_cols": numeric,
        "categorical_cols": categorical,
        "problem_type": problem,
        "target_col": target,
        "target_classes": list(model.classes_) if problem == "classification" else [],
        "schema_info": schema,
        "feature_importance": importance,
        "feature_importance_method": method,
        "evaluation": evaluation,
    }
    metrics = {
        "all_results": results,
        "feature_importance": importance,
        "feature_importance_method": method,
        "evaluation": evaluation,
        "schema_info": schema,
        "features": list(X.columns),
        "problem_type": problem,
        "target_column": target,
        "target_classes": bundle["target_classes"],
        "failed_candidates": failures,
    }
    return best, bundle, metrics, results[best]["score"]


def run_experiment(dataset_id, user_id, target, task=None, version_id=None):
    with transaction.atomic():
        dataset = Dataset.objects.select_for_update().get(
            pk=dataset_id, user_id=user_id
        )
        version = ensure_original(dataset)
        if version_id is not None and version.pk != int(version_id):
            raise ValueError(
                "The active dataset changed. Refresh before starting another experiment."
            )
        csv_text = version.csv_data
    df = pd.read_csv(io.StringIO(csv_text)).replace([np.inf, -np.inf], np.nan)
    original_rows = len(df)
    name, bundle, metrics, score = fit_experiment(df, target, task)
    metrics["evaluation"]["dropped_missing_targets"] = original_rows - int(
        df[target].notna().sum()
    )
    bundle["dataset_version_id"] = version.pk
    saved_path = save_model(bundle, f"model_{dataset_id}_{uuid.uuid4().hex}.pkl")
    return ModelRecord.objects.create(
        user_id=user_id,
        dataset_id=dataset_id,
        dataset_version=version,
        model_name=name,
        accuracy=score,
        metrics=metrics,
        file=saved_path,
        binary_data=pickle.dumps(bundle),
    )
