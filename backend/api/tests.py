import io
import json
import os
import pickle
import tempfile
import zipfile
from unittest.mock import patch
import numpy as np
import pandas as pd
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import Dataset, DatasetVersion, ModelRecord, SavedInsight, ChatHistory
from .insights import execute_plan, interpret_question
from .ml.experiments import fit_experiment
from .ml.preprocess import predict_with_bundle


class PlatformTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.media = tempfile.TemporaryDirectory()
        cls.settings_override = override_settings(MEDIA_ROOT=cls.media.name)
        cls.settings_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.settings_override.disable()
        cls.media.cleanup()
        super().tearDownClass()

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="analyst@example.test",
            email="analyst@example.test",
            password="Secure-password-42",
        )
        self.other = User.objects.create_user(
            username="other@example.test", password="Secure-password-42"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def upload(
        self,
        text="region,revenue,age\nNorth,10,20\nSouth,20,30\nNorth,,40\n",
        name="sample.csv",
    ):
        response = self.client.post(
            "/api/upload",
            {"file": SimpleUploadedFile(name, text.encode(), content_type="text/csv")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Dataset.objects.get(pk=response.data["dataset_id"])

    def training_dataset(self, regression=False):
        rng = np.random.default_rng(42)
        n = 60
        df = pd.DataFrame(
            {
                "x": rng.normal(size=n),
                "category": ["A", "B"] * (n // 2),
                "target": [10, 30] * (n // 2),
            }
        )
        if regression:
            df["target"] = df.x * 4 + 0.3
        return self.upload(df.to_csv(index=False), f"training-{regression}.csv")

    def train(self, dataset, task=None):
        response = self.client.post(
            "/api/train",
            {
                "dataset_id": dataset.pk,
                "target_column": "target",
                "version_id": dataset.active_version_id,
                "task": task,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return ModelRecord.objects.get(pk=response.data["id"])

    def test_registration_login_refresh_and_protected_access(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get("/api/datasets").status_code, 401)
        data = {
            "full_name": "Test Analyst",
            "email": "new@example.test",
            "password": "Secure-new-password-42",
            "confirm_password": "Secure-new-password-42",
        }
        self.assertEqual(anonymous.post("/api/register", data).status_code, 201)
        tokens = anonymous.post(
            "/api/login", {"email": data["email"], "password": data["password"]}
        ).data
        self.assertIn("refresh", tokens)
        refreshed = anonymous.post("/api/token/refresh", {"refresh": tokens["refresh"]})
        self.assertEqual(refreshed.status_code, 200)
        anonymous.credentials(HTTP_AUTHORIZATION="Bearer " + refreshed.data["access"])
        self.assertEqual(anonymous.get("/api/datasets").status_code, 200)

    def test_weak_password_and_invalid_email_rejected(self):
        for email, password in [
            ("not-email", "Secure-password-42"),
            ("valid@example.test", "123"),
        ]:
            result = APIClient().post(
                "/api/register",
                {
                    "full_name": "Tester",
                    "email": email,
                    "password": password,
                    "confirm_password": password,
                },
            )
            self.assertEqual(result.status_code, 400)

    def test_query_tokens_no_longer_authenticate(self):
        token = (
            APIClient()
            .post(
                "/api/login",
                {"email": self.user.email, "password": "Secure-password-42"},
            )
            .data["access"]
        )
        self.assertEqual(
            APIClient().get("/api/datasets", {"token": token}).status_code, 401
        )

    def test_upload_creates_original_and_real_schema(self):
        dataset = self.upload()
        self.assertEqual(dataset.versions.count(), 1)
        self.assertEqual(dataset.active_version.number, 1)
        self.assertEqual(dataset.metadata["eda_report"]["overview"]["total_rows"], 3)
        self.assertEqual(dataset.metadata["schema"][0]["type"], "object")
        self.assertEqual(dataset.active_version.csv_data, dataset.csv_data)

    def test_duplicate_filename_rejected(self):
        self.upload()
        response = self.client.post(
            "/api/upload", {"file": SimpleUploadedFile("sample.csv", b"x\n99\n")}
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Dataset.objects.count(), 1)

    def test_bad_csv_encodings_empty_duplicate_columns_malformed(self):
        for index, body in enumerate(
            [
                b"",
                b"x\n",
                b"a,a\n1,2\n",
                b"a,b\n1,2,3\n",
                b"a,b\n1\n",
                b"\xff\xfe\x00",
                b"\x00x",
            ]
        ):
            result = self.client.post(
                "/api/upload", {"file": SimpleUploadedFile(f"bad{index}.csv", body)}
            )
            self.assertEqual(result.status_code, 400, (body, result.data))
        result = self.client.post(
            "/api/upload", {"file": SimpleUploadedFile("bad.json", b"{}")}
        )
        self.assertEqual(result.status_code, 400)

    @override_settings(MAX_UPLOAD_BYTES=20)
    def test_upload_size_limit(self):
        result = self.client.post(
            "/api/upload",
            {"file": SimpleUploadedFile("big.csv", b"x\n" + b"1234567890\n" * 3)},
        )
        self.assertEqual(result.status_code, 400)

    def test_column_limit(self):
        text = (
            ",".join(f"x{i}" for i in range(101))
            + "\n"
            + ",".join("1" for _ in range(101))
            + "\n"
        )
        self.assertEqual(
            self.client.post(
                "/api/upload", {"file": SimpleUploadedFile("wide.csv", text.encode())}
            ).status_code,
            400,
        )

    def test_list_search_sort_pagination_and_direct_detail(self):
        for i in range(23):
            Dataset.objects.create(
                user=self.user, name=f"data-{i:02}.csv", csv_data="x\n1\n"
            )
        result = self.client.get("/api/datasets")
        self.assertEqual(result.data["count"], 23)
        self.assertEqual(len(result.data["results"]), 20)
        oldest = Dataset.objects.order_by("pk").first()
        self.assertEqual(self.client.get(f"/api/datasets/{oldest.pk}").status_code, 200)
        result = self.client.get(
            "/api/datasets", {"search": "data-02", "ordering": "name"}
        )
        self.assertEqual(result.data["count"], 1)

    def test_duplicate_download_delete_and_isolation(self):
        dataset = self.upload()
        response = self.client.post(f"/api/datasets/{dataset.pk}", {}, format="json")
        self.assertEqual(response.status_code, 201)
        duplicate = Dataset.objects.get(pk=response.data["id"])
        self.assertEqual(duplicate.csv_data, dataset.csv_data)
        self.assertEqual(duplicate.versions.count(), 1)
        download = self.client.get("/api/download-dataset", {"dataset_id": dataset.pk})
        self.assertEqual(
            b"".join(download.streaming_content).decode(), dataset.csv_data
        )
        self.client.force_authenticate(self.other)
        for path in [
            f"/api/datasets/{dataset.pk}",
            f"/api/datasets/{dataset.pk}/versions",
            f"/api/datasets/{dataset.pk}/versions/{dataset.active_version_id}",
        ]:
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(
            self.client.get(
                "/api/download-dataset", {"dataset_id": dataset.pk}
            ).status_code,
            404,
        )
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.client.delete(f"/api/datasets/{duplicate.pk}").status_code, 204
        )

    def test_eda_numeric_categorical_missing_and_constant(self):
        dataset = self.upload("category,constant,empty\nA,1,\nB,1,\nA,1,\n")
        result = self.client.get("/api/eda", {"dataset_id": dataset.pk})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["missing_values"]["empty"], 3)
        self.assertIsNone(result.data["correlation"][0]["value"])
        text_only = self.upload("category\nA\nB\n", "text.csv")
        result = self.client.get("/api/eda", {"dataset_id": text_only.pk})
        self.assertEqual(result.data["distributions"], {})

    def test_clean_preview_apply_cache_restore_compare_download(self):
        dataset = self.upload()
        original = dataset.csv_data
        v1 = dataset.active_version
        path = f"/api/datasets/{dataset.pk}/transform"
        data = {
            "action": "impute_missing",
            "column": "revenue",
            "strategy": "median",
            "version_id": v1.pk,
            "preview": True,
        }
        response = self.client.post(path, data, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["after"]["missing_cells"], 0)
        dataset.refresh_from_db()
        self.assertEqual(dataset.csv_data, original)
        self.assertEqual(dataset.versions.count(), 1)
        # TestCase defers on_commit callbacks, so execute them explicitly.
        cache.set(f"eda_dataset_{dataset.pk}", {"old": True})
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                path, {**data, "preview": False, "confirm": True}, format="json"
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(cache.get(f"eda_dataset_{dataset.pk}"))
        dataset.refresh_from_db()
        self.assertEqual(dataset.active_version.number, 2)
        self.assertEqual(dataset.metadata["eda_report"]["missing_values"]["revenue"], 0)
        self.assertEqual(v1.csv_data, original)
        v2 = dataset.active_version
        comparison = self.client.get(
            f"/api/datasets/{dataset.pk}/versions/{v2.pk}", {"compare": v1.pk}
        )
        self.assertEqual(comparison.data["comparison"]["delta"]["missing_cells"], -1)
        restore = self.client.post(
            f"/api/datasets/{dataset.pk}/versions/{v1.pk}",
            {"version_id": v2.pk, "confirm": True},
            format="json",
        )
        self.assertEqual(restore.status_code, 201, restore.data)
        dataset.refresh_from_db()
        self.assertEqual(dataset.csv_data, original)
        self.assertEqual(dataset.active_version.number, 3)
        result = self.client.get(
            f"/api/datasets/{dataset.pk}/versions/{v1.pk}", {"download": 1}
        )
        self.assertEqual(b"".join(result.streaming_content).decode(), original)

    def test_cleaning_requires_confirmation_correct_types_and_fresh_version(self):
        dataset = self.upload()
        path = f"/api/datasets/{dataset.pk}/transform"
        base = {
            "version_id": dataset.active_version_id,
            "action": "impute_missing",
            "column": "revenue",
            "strategy": "median",
        }
        self.assertEqual(self.client.post(path, base, format="json").status_code, 400)
        self.assertEqual(
            self.client.post(
                path, {**base, "version_id": 999, "preview": True}, format="json"
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.post(
                path,
                {**base, "column": "region", "strategy": "mean", "preview": True},
                format="json",
            ).status_code,
            400,
        )

    @override_settings(MAX_DATASET_VERSIONS=1)
    def test_version_retention_refuses_unbounded_growth(self):
        dataset = self.upload()
        result = self.client.post(
            f"/api/datasets/{dataset.pk}/transform",
            {
                "version_id": dataset.active_version_id,
                "action": "impute_missing",
                "column": "revenue",
                "strategy": "median",
                "confirm": True,
            },
            format="json",
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(dataset.versions.count(), 1)

    def test_restart_file_recovery(self):
        dataset = self.upload()
        os.remove(dataset.file.path)
        result = self.client.get("/api/download-dataset", {"dataset_id": dataset.pk})
        self.assertEqual(b"".join(result.streaming_content).decode(), dataset.csv_data)

    def test_classification_metrics_predict_persistence_lineage_and_bundle(self):
        dataset = self.training_dataset()
        record = self.train(dataset)
        self.assertEqual(record.dataset_version_id, dataset.active_version_id)
        self.assertEqual(record.metrics["evaluation"]["method"], "stratified holdout")
        self.assertEqual(set(record.metrics["target_classes"]), {"10", "30"})
        metrics = record.metrics["all_results"][record.model_name]
        self.assertEqual(
            sum(map(sum, metrics["confusion_matrix"])),
            record.metrics["evaluation"]["test_rows"],
        )
        inputs = {"x": 0, "category": "A"}
        expected = predict_with_bundle(pickle.loads(bytes(record.binary_data)), inputs)
        self.assertIn(expected["prediction"], ["10", "30"])
        os.remove(record.file.path)
        prediction = self.client.post(
            "/api/predict", {"model_id": record.pk, "inputs": inputs}, format="json"
        )
        self.assertEqual(prediction.status_code, 200, prediction.data)
        self.assertEqual(prediction.data["prediction"], expected["prediction"])
        artifact = self.client.get("/api/download-model", {"model_id": record.pk})
        self.assertTrue(b"".join(artifact.streaming_content))
        exported = self.client.get("/api/export-deployment", {"model_id": record.pk})
        z = zipfile.ZipFile(io.BytesIO(b"".join(exported.streaming_content)))
        self.assertTrue(
            {
                "app.py",
                "model.pkl",
                "predictor.py",
                "requirements.txt",
                "Dockerfile",
                "README.md",
            }
            <= set(z.namelist())
        )
        namespace = {}
        exec(compile(z.read("predictor.py"), "predictor.py", "exec"), namespace)
        exported_prediction = namespace["predict_with_bundle"](
            pickle.loads(z.read("model.pkl")), inputs
        )
        self.assertEqual(exported_prediction, expected)
        # Cleaning changes active source; historical pipeline remains the same.
        result = self.client.post(
            f"/api/datasets/{dataset.pk}/transform",
            {
                "version_id": dataset.active_version_id,
                "action": "drop_columns",
                "columns": ["category"],
                "confirm": True,
            },
            format="json",
        )
        self.assertEqual(result.status_code, 200, result.data)
        record.refresh_from_db()
        dataset.refresh_from_db()
        self.assertNotEqual(record.dataset_version_id, dataset.active_version_id)
        self.assertEqual(
            self.client.delete(f"/api/datasets/{dataset.pk}").status_code, 204
        )

    def test_regression_metrics_and_no_fake_confidence(self):
        dataset = self.training_dataset(True)
        record = self.train(dataset, "regression")
        metrics = record.metrics["all_results"][record.model_name]
        self.assertIn("mae", metrics)
        self.assertIn("rmse", metrics)
        self.assertEqual(metrics["score_name"], "R²")
        result = self.client.post(
            "/api/predict",
            {"model_id": record.pk, "inputs": {"x": 0.5, "category": "B"}},
            format="json",
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.assertIsNone(result.data["confidence"])
        self.assertIsInstance(result.data["prediction"], float)
        bad = self.client.post(
            "/api/predict",
            {"model_id": record.pk, "inputs": {"x": "bad", "category": "B"}},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

    def test_preprocessors_fit_on_training_rows_only(self):
        df = pd.DataFrame(
            {"x": range(50), "category": ["A", "B"] * 25, "target": np.arange(50) * 1.1}
        )
        _, bundle, metrics, _ = fit_experiment(df, "target", "regression")
        from sklearn.model_selection import train_test_split

        train, holdout = train_test_split(
            df.drop(columns="target"), test_size=10, random_state=42
        )
        scaler = (
            bundle["model"]
            .named_steps["preprocess"]
            .named_transformers_["numeric"]
            .named_steps["scale"]
        )
        self.assertAlmostEqual(scaler.mean_[0], train.x.mean())
        self.assertEqual(int(scaler.n_samples_seen_), len(train))
        self.assertNotEqual(scaler.mean_[0], df.x.mean())

    def test_small_single_class_and_missing_targets(self):
        for frame in [
            pd.DataFrame({"x": [1, 2], "target": [1, 2]}),
            pd.DataFrame({"x": range(20), "target": ["A"] * 20}),
        ]:
            with self.assertRaises(ValueError):
                fit_experiment(frame, "target")
        with self.assertRaises(ValueError):
            fit_experiment(
                pd.DataFrame({"x": range(20), "target": [1.0] * 20}),
                "target",
                "regression",
            )
        df = pd.DataFrame({"x": range(50), "target": np.arange(50) * 1.1})
        df.loc[:4, "target"] = None
        _, bundle, metrics, _ = fit_experiment(df, "target", "regression")
        self.assertEqual(
            metrics["evaluation"]["training_rows"] + metrics["evaluation"]["test_rows"],
            45,
        )

    def test_all_missing_and_unseen_categories(self):
        frame = pd.DataFrame(
            {
                "empty": [np.nan] * 40,
                "category": ["A", "B"] * 20,
                "target": ["yes", "no"] * 20,
            }
        )
        _, bundle, _, _ = fit_experiment(frame, "target")
        result = predict_with_bundle(bundle, {"empty": 0, "category": "unseen"})
        self.assertIn(result["prediction"], ["yes", "no"])

    def test_model_and_report_authorization_and_html_escaping(self):
        dataset = self.training_dataset()
        record = self.train(dataset)
        dataset.name = "<script>alert(1)</script>.csv"
        dataset.save(update_fields=["name"])
        result = self.client.get(
            "/api/export-report", {"dataset_id": dataset.pk, "model_id": record.pk}
        )
        self.assertEqual(result.status_code, 200)
        self.assertIn("text/html", result["Content-Type"])
        self.assertNotIn("<script>", result.content.decode())
        self.assertIn("&lt;script&gt;", result.content.decode())
        self.client.force_authenticate(self.other)
        for endpoint in ["download-model", "export-deployment", "model-schema"]:
            self.assertEqual(
                self.client.get(
                    "/api/" + endpoint, {"model_id": record.pk}
                ).status_code,
                404,
            )
        self.assertEqual(
            self.client.get(
                "/api/export-report", {"dataset_id": dataset.pk}
            ).status_code,
            404,
        )

    @patch.dict(os.environ, {"GROQ_API_KEY": ""})
    def test_insight_generate_save_retrieve_delete_stale_and_isolation(self):
        dataset = self.upload()
        body = {
            "dataset_id": dataset.pk,
            "version_id": dataset.active_version_id,
            "question": "Show average revenue by region",
        }
        generated = self.client.post("/api/insights", body, format="json")
        self.assertEqual(generated.status_code, 200, generated.data)
        self.assertEqual(
            {x["label"]: x["value"] for x in generated.data["result"]["data"]},
            {"South": 20.0, "North": 10.0},
        )
        saved = self.client.post(
            "/api/insights",
            {
                **body,
                "save": True,
                "plan": generated.data["plan"],
                "interpretation": "fake",
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertNotEqual(saved.data["interpretation"], "fake")
        insight_id = saved.data["id"]
        self.assertEqual(self.client.get("/api/insights").data["count"], 1)
        self.client.post(
            f"/api/datasets/{dataset.pk}/transform",
            {
                "version_id": dataset.active_version_id,
                "action": "impute_missing",
                "column": "revenue",
                "strategy": "median",
                "confirm": True,
            },
            format="json",
        )
        self.assertTrue(self.client.get(f"/api/insights/{insight_id}").data["stale"])
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(f"/api/insights/{insight_id}").status_code, 404
        )
        self.assertEqual(
            self.client.delete(f"/api/insights/{insight_id}").status_code, 404
        )
        self.assertEqual(
            self.client.post("/api/insights", body, format="json").status_code, 404
        )
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.client.delete(f"/api/insights/{insight_id}").status_code, 204
        )

    def test_plan_validation_unknown_columns_unsupported_operations_limits_empty(self):
        frame = pd.DataFrame({"category": ["a", "b"], "revenue": [10, 20]})
        invalid = [
            {"operation": "exec", "value": "revenue"},
            {"operation": "mean", "value": "absent"},
            {"operation": "mean", "value": "category"},
            {"operation": "count", "limit": 100000},
            {
                "operation": "count",
                "filters": [{"column": "revenue", "operator": "gt", "value": 100}],
            },
            {"operation": "count", "code": "print(1)"},
            {"operation": "scatter", "x": "revenue", "y": "absent"},
            {"operation": "count", "chart": "scatter"},
        ]
        for plan in invalid:
            with self.assertRaises(ValueError, msg=str(plan)):
                execute_plan(frame, plan)

    def test_supported_analytics_time_scatter_histogram_filters_kpi(self):
        frame = pd.DataFrame(
            {
                "category": ["a", "b", "a"],
                "date": ["2026-01-01", "2026-02-01", "2026-01-02"],
                "revenue": [10, 20, 30],
                "cost": [5, 8, 10],
            }
        )
        result = execute_plan(
            frame,
            {
                "operation": "sum",
                "value": "revenue",
                "group_by": "date",
                "interval": "month",
            },
        )
        self.assertEqual(result["chart"], "line")
        self.assertEqual(result["data"][0]["value"], 40)
        result = execute_plan(
            frame, {"operation": "scatter", "x": "revenue", "y": "cost"}
        )
        self.assertEqual(len(result["data"]), 3)
        result = execute_plan(frame, {"operation": "histogram", "value": "revenue"})
        self.assertEqual(sum(item["value"] for item in result["data"]), 3)
        result = execute_plan(
            frame,
            {
                "operation": "mean",
                "value": "revenue",
                "filters": [{"column": "cost", "operator": "gte", "value": 8}],
            },
        )
        self.assertEqual(result["data"][0]["value"], 25)
        with self.assertRaises(ValueError):
            execute_plan(pd.DataFrame({"x": range(100001)}), {"operation": "count"})

    @patch.dict(os.environ, {"GROQ_API_KEY": ""})
    def test_missing_key_does_not_fake_unsupported_insight(self):
        with self.assertRaises(ValueError):
            interpret_question(
                "Show revenue where region is north",
                pd.DataFrame({"region": ["north"], "revenue": [1]}),
            )

    @patch.dict(os.environ, {"GROQ_API_KEY": "test-not-a-real-key"})
    @patch("langchain_groq.ChatGroq")
    def test_mocked_ai_plan_and_invalid_output(self, provider):
        frame = pd.DataFrame({"region": ["North"], "revenue": [1]})
        provider.return_value.invoke.return_value.content = (
            '{"operation":"count","group_by":"region"}'
        )
        plan, method = interpret_question("Compare only the observations", frame)
        self.assertEqual(method, "AI structured plan")
        self.assertEqual(execute_plan(frame, plan)["data"][0]["value"], 1)
        provider.return_value.invoke.return_value.content = "not JSON"
        with self.assertRaises(ValueError):
            interpret_question("Compare only observations", frame)

    @patch("api.agent.workflow.process_chat_query", return_value="Measured: 3 records.")
    def test_chat_history_pagination_and_provider_failure(self, provider):
        dataset = self.upload()
        result = self.client.post(
            "/api/chat",
            {"dataset_id": dataset.pk, "question": "How many rows?"},
            format="json",
        )
        self.assertEqual(result.status_code, 200, result.data)
        provider.assert_called_once()
        self.assertEqual(provider.call_args.kwargs["user_id"], self.user.pk)
        for i in range(25):
            ChatHistory.objects.create(
                dataset=dataset, user=self.user, question=f"q{i}", answer="answer"
            )
        history = self.client.get("/api/chat", {"dataset_id": dataset.pk})
        self.assertEqual(history.data["count"], 26)
        self.assertEqual(len(history.data["results"]), 20)
        self.assertEqual(history.data["results"][0]["question"], "q24")
        provider.side_effect = RuntimeError("provider internal detail")
        failed = self.client.post(
            "/api/chat",
            {"dataset_id": dataset.pk, "question": "try again"},
            format="json",
        )
        self.assertEqual(failed.status_code, 503)
        self.assertNotIn("internal detail", str(failed.data))
        self.assertEqual(ChatHistory.objects.count(), 26)

    def test_tools_cannot_select_other_users_dataset(self):
        from .agent.tools import build_tools

        dataset = self.upload()
        good = build_tools(self.user.pk, dataset.pk)[0]
        self.assertEqual(good.args, {})
        self.assertIn("total_rows", good.invoke({}))
        bad = build_tools(self.other.pk, dataset.pk)[0]
        with self.assertRaises(Dataset.DoesNotExist):
            bad.invoke({})

    def test_summary_reports_real_counts(self):
        dataset = self.upload()
        summary = self.client.get("/api/summary")
        self.assertEqual(summary.data["datasets"], 1)
        self.assertEqual(summary.data["records"], 3)
        self.assertNotIn("storage", summary.data)

    def test_training_lease_blocks_duplicate_workers(self):
        from django.utils import timezone

        dataset = self.training_dataset()
        dataset.training_started_at = timezone.now()
        dataset.save(update_fields=["training_started_at"])
        result = self.client.post(
            "/api/train",
            {"dataset_id": dataset.pk, "target_column": "target"},
            format="json",
        )
        self.assertEqual(result.status_code, 409)
        self.assertEqual(ModelRecord.objects.count(), 0)

    def test_legacy_summary_does_not_invent_missing_record_totals(self):
        Dataset.objects.create(
            user=self.user,
            name="legacy.csv",
            metadata={"eda_report": None},
            csv_data="x\n1\n",
        )
        response = self.client.get("/api/summary")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["records"])

    def test_boolean_features_and_unknown_numeric_target_classes(self):
        frame = pd.DataFrame(
            {"flag": [True, False] * 20, "number": range(40), "target": [10, 30] * 20}
        )
        _, bundle, metrics, _ = fit_experiment(frame, "target")
        result = predict_with_bundle(bundle, {"flag": "True", "number": 12})
        self.assertIn(result["prediction"], ["10", "30"])
        self.assertIn("Naive Bayes", metrics["all_results"])

    def test_empty_and_unknown_plan_fields_fail_safely(self):
        frame = pd.DataFrame({"x": [1, 2]})
        for plan in [
            None,
            [],
            {"operation": "histogram", "value": "x", "group_by": "unknown"},
            {"operation": "scatter", "x": "x", "y": "x", "group_by": "x"},
        ]:
            with self.assertRaises(ValueError):
                execute_plan(frame, plan)
        self.assertEqual(
            self.client.post(
                "/api/insights", {"dataset_id": "invalid"}, format="json"
            ).status_code,
            404,
        )

    @patch.dict(os.environ, {"GROQ_API_KEY": "test-only-not-real"})
    @patch("api.agent.workflow.ChatGroq")
    def test_real_graph_dispatches_owner_bound_tool_with_mocked_provider(
        self, provider
    ):
        from langchain_core.messages import AIMessage, ToolMessage

        dataset = self.upload()
        provider.return_value.bind_tools.return_value.invoke.side_effect = [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "get_dataset_schema",
                        "args": {},
                        "id": "call-1",
                        "type": "tool_call",
                    }
                ],
            ),
            AIMessage(content="Measured: 3 records in the selected dataset."),
        ]
        response = self.client.post(
            "/api/chat",
            {"dataset_id": dataset.pk, "question": "How many rows?"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        calls = provider.return_value.bind_tools.return_value.invoke.call_args_list
        self.assertEqual(len(calls), 2)
        tool_result = next(
            item for item in calls[1].args[0] if isinstance(item, ToolMessage)
        )
        self.assertEqual(json.loads(tool_result.content)["overview"]["total_rows"], 3)
        self.assertEqual(ChatHistory.objects.count(), 1)

    def test_historical_artifacts_ignore_a_reused_disk_path(self):
        import joblib
        from sklearn.dummy import DummyClassifier

        dataset = self.training_dataset()
        record = self.train(dataset)
        original = pickle.loads(bytes(record.binary_data))
        incorrect = dict(original)
        incorrect["model_name"] = "Wrong disk snapshot"
        incorrect["model"] = DummyClassifier(strategy="constant", constant="wrong").fit(
            pd.DataFrame({"x": [0], "category": ["A"]}), ["wrong"]
        )
        joblib.dump(incorrect, record.file.path)
        result = self.client.post(
            "/api/predict",
            {"model_id": record.pk, "inputs": {"x": 0, "category": "A"}},
            format="json",
        )
        self.assertEqual(result.status_code, 200, result.data)
        self.assertNotEqual(result.data["prediction"], "wrong")
        artifact = self.client.get("/api/download-model", {"model_id": record.pk})
        self.assertEqual(
            b"".join(artifact.streaming_content), bytes(record.binary_data)
        )
        exported = self.client.get("/api/export-deployment", {"model_id": record.pk})
        archive = zipfile.ZipFile(io.BytesIO(b"".join(exported.streaming_content)))
        self.assertEqual(
            pickle.loads(archive.read("model.pkl"))["model_name"],
            original["model_name"],
        )

    @override_settings(
        PASSWORD_HASHERS=[
            "django.contrib.auth.hashers.PBKDF2PasswordHasher",
            "django.contrib.auth.hashers.MD5PasswordHasher",
        ]
    )
    def test_existing_md5_account_is_upgraded_on_login(self):
        from django.contrib.auth.hashers import make_password

        self.user.password = make_password("Secure-password-42", hasher="md5")
        self.user.save(update_fields=["password"])
        response = APIClient().post(
            "/api/login", {"email": self.user.email, "password": "Secure-password-42"}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.password.startswith("pbkdf2_sha256$"))
