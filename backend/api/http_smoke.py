"""Optional full HTTP workflow against an explicitly isolated local server.

Creates and removes one fixture dataset. Never accepts a production hostname.
QA_EMAIL / QA_PASSWORD refer only to an account in the disposable local database.
"""

import io
import json
import os
from pathlib import Path
import urllib.request
import urllib.error
from urllib.parse import urlparse
import uuid
import zipfile


def main():
    base = os.environ.get("QA_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
    if urlparse(base).hostname not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("Use a disposable local test server, never production.")
    token = None
    dataset_id = None
    checks = []

    def request(method, path, body=None, expected=200, raw=False, multipart=False):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if multipart:
            headers["Content-Type"] = (
                "multipart/form-data; boundary=qa-fixture-boundary"
            )
        elif body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body).encode()
        req = urllib.request.Request(
            base + "/api" + path, data=body, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                assert response.status == expected, (path, response.status)
                result = response.read()
        except urllib.error.HTTPError as exc:
            assert exc.code == expected, (path, exc.code, exc.read().decode()[:300])
            result = exc.read()
        checks.append(path.split("?")[0])
        return result if raw or not result else json.loads(result)

    credentials = {
        "email": os.environ["QA_EMAIL"],
        "password": os.environ["QA_PASSWORD"],
    }
    token = request("POST", "/login", credentials)["access"]
    try:
        text = Path(__file__).resolve().parents[2] / "docs/fixtures/retail-workflow.csv"
        filename = f"http-workflow-qa-{uuid.uuid4().hex[:8]}.csv"
        body = (
            f'--qa-fixture-boundary\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: text/csv\r\n\r\n'.encode()
            + text.read_bytes()
            + b"\r\n--qa-fixture-boundary--\r\n"
        )
        uploaded = request("POST", "/upload", body, 201, multipart=True)
        dataset_id, version = uploaded["dataset_id"], uploaded["version"]["id"]
        request("GET", f"/datasets/{dataset_id}")
        request("GET", f"/eda?dataset_id={dataset_id}")
        operation = {
            "action": "impute_missing",
            "column": "revenue",
            "strategy": "median",
            "version_id": version,
        }
        preview = request(
            "POST", f"/datasets/{dataset_id}/transform", {**operation, "preview": True}
        )
        assert preview["after"]["missing_cells"] == 0
        cleaned = request(
            "POST", f"/datasets/{dataset_id}/transform", {**operation, "confirm": True}
        )
        version2 = cleaned["version"]["id"]
        run = request(
            "POST",
            "/train",
            {
                "dataset_id": dataset_id,
                "version_id": version2,
                "target_column": "retained",
            },
            201,
        )
        assert len(run["metrics"]["all_results"]) == 6
        fields = request("GET", f'/model-schema?model_id={run["id"]}')["schema_info"]
        result = request(
            "POST",
            "/predict",
            {
                "model_id": run["id"],
                "inputs": {field["name"]: field["default"] for field in fields},
            },
        )
        assert result["prediction"] in ("Yes", "No")
        question = {
            "dataset_id": dataset_id,
            "version_id": version2,
            "question": "Show average revenue by region",
        }
        generated = request("POST", "/insights", question)
        saved = request(
            "POST",
            "/insights",
            {**question, "save": True, "plan": generated["plan"]},
            201,
        )
        assert saved["result"]["evidence"]["rows_used"] == 20
        request("GET", f'/insights/{saved["id"]}')
        request(
            "POST",
            f"/datasets/{dataset_id}/versions/{version}",
            {"version_id": version2, "confirm": True},
            201,
        )
        assert request("GET", f'/insights/{saved["id"]}')["stale"]
        report = request(
            "GET",
            f'/export-report?dataset_id={dataset_id}&model_id={run["id"]}',
            raw=True,
        )
        assert b"Feature importance" in report
        archive = request("GET", f'/export-deployment?model_id={run["id"]}', raw=True)
        assert "predictor.py" in zipfile.ZipFile(io.BytesIO(archive)).namelist()
        request(
            "GET", f"/datasets/{dataset_id}/versions/{version}?download=1", raw=True
        )
        request(
            "POST",
            "/chat",
            {"dataset_id": dataset_id, "question": "Which columns are missing?"},
            503,
        )
    finally:
        if dataset_id:
            request("DELETE", f"/datasets/{dataset_id}", expected=204)
    print(
        json.dumps(
            {
                "http_checks_passed": len(checks),
                "dataset_cleanup": True,
                "paid_provider_used": False,
            }
        )
    )


if __name__ == "__main__":
    main()
