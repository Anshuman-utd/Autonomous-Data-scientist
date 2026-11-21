"""Record-specific artifact access; legacy records may share a mutable disk path."""

import io
import os


def model_bytes(record):
    # A record's database snapshot is authoritative, especially for historical
    # rows whose legacy model_<dataset>.pkl filename was reused by later runs.
    if record.binary_data:
        return bytes(record.binary_data)
    if record.file and os.path.exists(record.file.path):
        with open(record.file.path, "rb") as source:
            return source.read()
    return None


def load_model_bundle(record):
    import joblib

    payload = model_bytes(record)
    if not payload:
        return None
    try:
        # Only deserialize server-created artifacts after owner authorization.
        return joblib.load(io.BytesIO(payload))
    except Exception:
        return None
