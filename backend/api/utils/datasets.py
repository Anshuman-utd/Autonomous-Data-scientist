"""Bounded CSV parsing and JSON-safe metadata shared by upload, versions and EDA."""

import csv
import io
import json
import pandas as pd
import numpy as np
from django.conf import settings
from .eda import perform_eda


def parse_csv(text):
    if not isinstance(text, str) or not text.strip() or "\x00" in text:
        raise ValueError("Choose a non-empty UTF-8 CSV file.")
    if len(text.encode("utf-8")) > settings.MAX_UPLOAD_BYTES:
        raise ValueError("CSV files must be 10 MB or smaller.")
    try:
        header = next(csv.reader(io.StringIO(text), strict=True))
        if not header or len(header) > settings.MAX_DATASET_COLUMNS:
            raise ValueError("CSV files support at most 100 columns.")
        if any(not name.strip() or len(name) > 200 for name in header) or len(
            set(header)
        ) != len(header):
            raise ValueError(
                "Column names must be unique, non-empty, and at most 200 characters."
            )
        # Strict width validation catches both missing and excess fields; quoted newlines remain valid.
        count = 0
        for row in csv.reader(io.StringIO(text), strict=True):
            if not row:
                continue
            if count and len(row) != len(header):
                raise ValueError(
                    "Every CSV row must have the same number of fields as the header."
                )
            count += 1
            if count > settings.MAX_DATASET_ROWS + 1:
                raise ValueError("CSV files support at most 100,000 rows.")
        df = pd.read_csv(io.StringIO(text), nrows=settings.MAX_DATASET_ROWS + 1)
    except (
        pd.errors.ParserError,
        pd.errors.EmptyDataError,
        csv.Error,
        StopIteration,
    ) as exc:
        raise ValueError(
            "The CSV is empty or malformed. Check its header and delimiters."
        ) from exc
    if df.empty:
        raise ValueError("The CSV must contain a header and at least one data row.")
    if len(df) > settings.MAX_DATASET_ROWS:
        raise ValueError("CSV files support at most 100,000 rows.")
    return df.replace([np.inf, -np.inf], np.nan)


def metadata_for(df):
    # JSON roundtrip converts pandas/numpy scalars, NaN and infinities safely.
    preview = json.loads(df.head(20).to_json(orient="records", date_format="iso"))
    report = perform_eda(io.StringIO(df.to_csv(index=False)))
    if "error" in report:
        raise ValueError(report["error"])
    schema = [
        {
            "name": str(col),
            "type": str(df[col].dtype),
            "missing": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        }
        for col in df.columns
    ]
    return {
        "columns": df.columns.tolist(),
        "preview": preview,
        "schema": schema,
        "eda_report": report,
    }
