"""Immutable bounded snapshots. Original and historical lineage are never pruned."""

import io
import pandas as pd
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from .models import DatasetVersion
from .utils.datasets import metadata_for
from .utils.file_handler import ensure_dataset_file_on_disk


def ensure_original(dataset):
    if dataset.active_version_id:
        return dataset.active_version
    text = dataset.csv_data
    if not text:
        path = ensure_dataset_file_on_disk(dataset)
        if not path:
            raise ValueError("The source CSV is unavailable.")
        with open(path, encoding="utf-8-sig") as source:
            text = source.read()
    metadata = metadata_for(pd.read_csv(io.StringIO(text)))
    version, _ = DatasetVersion.objects.get_or_create(
        dataset=dataset,
        number=1,
        defaults={
            "csv_data": text,
            "metadata": metadata,
            "description": "Imported baseline (pre-version history)",
            "operation": {"action": "upload"},
        },
    )
    dataset.active_version = version
    dataset.metadata = version.metadata
    dataset.csv_data = version.csv_data
    dataset.save(update_fields=["active_version", "metadata", "csv_data"])
    return version


def quality(df):
    return {
        "rows": len(df),
        "columns": len(df.columns),
        "missing_cells": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
    }


def transform(df, operation):
    if not isinstance(operation, dict):
        raise ValueError("Provide a cleaning operation.")
    frame = df.copy(deep=True)
    action, column = operation.get("action"), operation.get("column")
    if action == "remove_duplicates":
        frame = frame.drop_duplicates()
        description = "Remove duplicate rows"
    elif action == "drop_columns":
        columns = operation.get("columns")
        if (
            not isinstance(columns, list)
            or not columns
            or any(c not in frame for c in columns)
        ):
            raise ValueError("Choose existing columns to remove.")
        if len(set(columns)) >= len(frame.columns):
            raise ValueError("Keep at least one column.")
        frame = frame.drop(columns=columns)
        description = "Remove columns: " + ", ".join(columns)
    elif action in ("impute_missing", "remove_outliers"):
        if column not in frame:
            raise ValueError("Select an existing column.")
        numeric = pd.api.types.is_numeric_dtype(frame[column])
        if action == "remove_outliers":
            if not numeric:
                raise ValueError("Outlier removal requires a numeric column.")
            q1, q3 = frame[column].quantile([0.25, 0.75])
            iqr = q3 - q1
            frame = frame[
                frame[column].isna()
                | frame[column].between(q1 - 1.5 * iqr, q3 + 1.5 * iqr)
            ]
            description = f"Remove IQR outlier rows in {column}"
        else:
            strategy = operation.get("strategy", "median" if numeric else "mode")
            if strategy not in ("median", "mean", "mode", "zero", "drop"):
                raise ValueError("Unsupported missing-value strategy.")
            if strategy == "drop":
                frame = frame.dropna(subset=[column])
            else:
                if not numeric and strategy not in ("mode",):
                    raise ValueError(
                        "Categorical columns support mode or dropping missing rows."
                    )
                if strategy == "mode":
                    values = frame[column].mode()
                    if values.empty:
                        raise ValueError(
                            "This column has no observed values to infer a mode."
                        )
                    value = values.iloc[0]
                else:
                    value = (
                        0 if strategy == "zero" else getattr(frame[column], strategy)()
                    )
                if pd.isna(value):
                    raise ValueError(
                        "This column has no observed values. Choose zero or remove it."
                    )
                frame[column] = frame[column].fillna(value)
            description = f"Handle missing values in {column}: {strategy}"
    else:
        raise ValueError(
            "Unsupported transformation. Choose imputation, outlier removal, duplicate removal or column removal."
        )
    if frame.empty:
        raise ValueError("This operation would remove all records.")
    if frame.equals(df):
        raise ValueError("This operation would not change any data.")
    return frame, description


def create_version(dataset, text, metadata, description, operation):
    versions = dataset.versions.order_by("-number")
    if versions.count() >= settings.MAX_DATASET_VERSIONS:
        raise ValueError(
            "This dataset reached its 20-version limit. Duplicate the active dataset to start a new history; existing versions remain recoverable."
        )
    existing_bytes = sum(
        len(value.encode("utf-8"))
        for value in versions.values_list("csv_data", flat=True)
    )
    if existing_bytes + len(text.encode("utf-8")) > settings.MAX_VERSION_BYTES:
        raise ValueError(
            "This dataset reached its 100 MB history budget. Duplicate the active dataset to start a new history."
        )
    latest = versions.first()
    version = DatasetVersion.objects.create(
        dataset=dataset,
        number=latest.number + 1 if latest else 1,
        csv_data=text,
        metadata=metadata,
        description=description[:500],
        operation=operation,
    )
    old_file_name = dataset.file.name
    dataset.active_version = version
    dataset.csv_data, dataset.metadata = text, metadata
    # Snapshot files get unique names. Never overwrite a historical file or rely on disk for truth.
    from django.core.files.base import ContentFile

    dataset.file.save(
        f"dataset_{dataset.pk}_v{version.number}.csv",
        ContentFile(text.encode()),
        save=False,
    )
    dataset.save(update_fields=["active_version", "csv_data", "metadata", "file"])

    def invalidate():
        if old_file_name and old_file_name != dataset.file.name:
            dataset.file.storage.delete(old_file_name)
        try:
            cache.delete(f"eda_dataset_{dataset.pk}")
        except Exception:
            pass

    transaction.on_commit(invalidate)
    return version
