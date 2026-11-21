"""Validate an exported, trusted bundle without deploying it.

Usage: python -m api.export_smoke /path/to/deployment.zip
Requires optional FastAPI/httpx development dependencies.
"""

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import zipfile


def main(path):
    from fastapi.testclient import TestClient
    import joblib

    with tempfile.TemporaryDirectory() as directory:
        destination = Path(directory)
        with zipfile.ZipFile(path) as source:
            expected = {
                "app.py",
                "predictor.py",
                "model.pkl",
                "requirements.txt",
                "Dockerfile",
                "README.md",
            }
            if set(source.namelist()) != expected:
                raise ValueError(
                    "Unexpected bundle contents; only validate a trusted platform export."
                )
            source.extractall(destination)
        bundle = joblib.load(destination / "model.pkl")
        inputs = {
            field["name"]: field.get("default") for field in bundle["schema_info"]
        }
        sys.path.insert(0, directory)
        spec = importlib.util.spec_from_file_location(
            "exported_app", destination / "app.py"
        )
        app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(app)
        client = TestClient(app.app)
        health = client.get("/health")
        prediction = client.post("/predict", json={"inputs": inputs})
        assert health.status_code == 200, health.text
        assert prediction.status_code == 200, prediction.text
        from predictor import predict_with_bundle

        assert prediction.json() == predict_with_bundle(bundle, inputs)
        print(
            json.dumps(
                {
                    "health": health.status_code,
                    "prediction": prediction.status_code,
                    "matches_original_predictor": True,
                    "source_version": health.json()["source_version"],
                }
            )
        )


if __name__ == "__main__":
    main(sys.argv[1])
