"""Version-aware API workflows, scoped at the database boundary."""

import io
import os
from datetime import timedelta
import pandas as pd
from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import transaction, IntegrityError
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from .models import Dataset, DatasetVersion, ModelRecord, SavedInsight
from .serializers import (
    DatasetSerializer,
    DatasetVersionSerializer,
    ModelRecordSerializer,
    SavedInsightSerializer,
)
from .utils.datasets import parse_csv, metadata_for
from .versions import ensure_original, create_version, transform, quality
from .views import StandardResultsPagination


def owned(request, pk, lock=False):
    if isinstance(pk, bool) or not str(pk).isdigit():
        raise Http404
    qs = Dataset.objects.filter(user=request.user)
    if lock:
        qs = qs.select_for_update()
    return get_object_or_404(qs, pk=pk)


def paginated(request, qs, serializer, compact=False):
    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(
        serializer(
            page, many=True, context={"request": request, "compact": compact}
        ).data
    )


class UploadView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "uploads"
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "Choose a CSV file."}, status=400)
        name = os.path.basename(file.name)
        if not name.lower().endswith(".csv") or len(name) > 230:
            return Response(
                {"error": "Choose a CSV with a filename shorter than 230 characters."},
                status=400,
            )
        if file.size > settings.MAX_UPLOAD_BYTES:
            return Response(
                {"error": "CSV files must be 10 MB or smaller."}, status=400
            )
        if Dataset.objects.filter(user=request.user, name=name).exists():
            return Response(
                {
                    "error": "A dataset with this filename already exists. Rename your file to upload a separate dataset, or open the existing dataset."
                },
                status=409,
            )
        try:
            text = file.read().decode("utf-8-sig")
            df = parse_csv(text)
            normalized = df.to_csv(index=False)
            if len(normalized.encode()) > settings.MAX_UPLOAD_BYTES:
                raise ValueError("The normalized CSV exceeds the 10 MB limit.")
            metadata = metadata_for(df)
            with transaction.atomic():
                dataset = Dataset.objects.create(
                    user=request.user, name=name, csv_data=normalized, metadata=metadata
                )
                # Preserve original bytes (decoded BOM) as v1; no missing cells silently replaced.
                version = DatasetVersion.objects.create(
                    dataset=dataset,
                    number=1,
                    csv_data=text,
                    metadata=metadata,
                    description="Original upload",
                    operation={"action": "upload"},
                )
                dataset.active_version = version
                dataset.csv_data = text
                dataset.file.save(
                    f"dataset_{dataset.pk}_v1.csv",
                    ContentFile(text.encode()),
                    save=False,
                )
                dataset.save()
            return Response(
                {
                    "dataset_id": dataset.pk,
                    "columns": metadata["columns"],
                    "preview": metadata["preview"],
                    "version": DatasetVersionSerializer(version).data,
                },
                status=201,
            )
        except UnicodeDecodeError:
            return Response(
                {
                    "error": "CSV encoding must be UTF-8. Re-export your file as UTF-8 CSV."
                },
                status=400,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        except IntegrityError:
            return Response(
                {"error": "A dataset with this filename already exists."}, status=409
            )


class DatasetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Dataset.objects.filter(user=request.user)
            .select_related("user", "active_version")
            .defer("csv_data", "active_version__csv_data", "active_version__metadata")
        )
        search = request.query_params.get("search", "")[:200]
        if search:
            qs = qs.filter(name__icontains=search)
        filtering = request.query_params.get("filter")
        if filtering == "recent":
            qs = qs.filter(uploaded_at__gte=timezone.now() - timedelta(days=7))
        elif filtering == "trained":
            qs = qs.filter(models__isnull=False).distinct()
        order = request.query_params.get("ordering", "-uploaded_at")
        if order not in ("name", "-name", "uploaded_at", "-uploaded_at"):
            order = "-uploaded_at"
        return paginated(
            request, qs.order_by(order, "-id"), DatasetSerializer, compact=True
        )


class DetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        with transaction.atomic():
            dataset = owned(request, pk, lock=True)
            ensure_original(dataset)
        return Response(DatasetSerializer(dataset, context={"request": request}).data)

    def delete(self, request, pk):
        dataset = owned(request, pk)
        files = [dataset.file.name] + list(
            dataset.models.values_list("file", flat=True)
        )
        storage = dataset.file.storage
        dataset.delete()
        for name in files:
            if name:
                storage.delete(name)
        try:
            cache.delete(f"eda_dataset_{pk}")
        except Exception:
            pass
        return Response(status=204)

    def post(self, request, pk):
        with transaction.atomic():
            dataset = owned(request, pk, lock=True)
            version = ensure_original(dataset)
            base = dataset.name[:210]
            suffix, name = 1, f"{base} (Copy)"
            while Dataset.objects.filter(user=request.user, name=name).exists():
                suffix += 1
                name = f"{base} (Copy {suffix})"
            duplicate = Dataset.objects.create(
                user=request.user,
                name=name,
                csv_data=version.csv_data,
                metadata=version.metadata,
            )
            duplicate.file.save(
                f"dataset_{duplicate.pk}_v1.csv",
                ContentFile(version.csv_data.encode()),
                save=True,
            )
            ensure_original(duplicate)
        return Response(
            DatasetSerializer(duplicate, context={"request": request}).data, status=201
        )


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        datasets = Dataset.objects.filter(user=request.user)
        models = (
            ModelRecord.objects.filter(user=request.user)
            .select_related("user", "dataset", "dataset_version")
            .defer(
                "binary_data",
                "dataset__csv_data",
                "dataset__metadata",
                "dataset_version__csv_data",
                "dataset_version__metadata",
            )
        )
        insights = SavedInsight.objects.filter(user=request.user).select_related(
            "dataset", "dataset_version"
        )
        counts = [
            ((metadata or {}).get("eda_report") or {})
            .get("overview", {})
            .get("total_rows")
            for metadata in datasets.values_list("metadata", flat=True)
        ]
        rows = sum(counts) if all(isinstance(count, int) for count in counts) else None
        return Response(
            {
                "datasets": datasets.count(),
                "models": models.count(),
                "records": rows,
                "insights": insights.count(),
                "recent_models": ModelRecordSerializer(models[:5], many=True).data,
                "recent_insights": SavedInsightSerializer(insights[:4], many=True).data,
            }
        )


class TransformView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                dataset = owned(request, pk, lock=True)
                version = ensure_original(dataset)
                if request.data.get("version_id") != version.pk:
                    return Response(
                        {
                            "error": "The active version changed. Refresh before previewing or applying this operation."
                        },
                        status=409,
                    )
                df = pd.read_csv(io.StringIO(version.csv_data))
                operation = {
                    key: value
                    for key, value in request.data.items()
                    if key in ("action", "column", "columns", "strategy")
                }
                cleaned, description = transform(df, operation)
                result = {
                    "before": quality(df),
                    "after": quality(cleaned),
                    "description": description,
                    "preview": __import__("json").loads(
                        cleaned.head(20).to_json(orient="records")
                    ),
                    "source_version_id": version.pk,
                }
                if request.data.get("preview") is True:
                    return Response(result)
                if request.data.get("confirm") is not True:
                    return Response(
                        {
                            "error": "Preview the operation and confirm before applying it."
                        },
                        status=400,
                    )
                new = create_version(
                    dataset,
                    cleaned.to_csv(index=False),
                    metadata_for(cleaned),
                    description,
                    operation,
                )
                result.update(
                    version=DatasetVersionSerializer(new).data,
                    eda_report=new.metadata["eda_report"],
                    columns=new.metadata["columns"],
                )
            return Response(result)
        except (ValueError, TypeError) as exc:
            return Response({"error": str(exc)}, status=400)


class VersionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        with transaction.atomic():
            dataset = owned(request, pk, lock=True)
            ensure_original(dataset)
        return Response(
            {
                "results": DatasetVersionSerializer(
                    dataset.versions.select_related("dataset"), many=True
                ).data,
                "limit": settings.MAX_DATASET_VERSIONS,
            }
        )


class VersionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, version_id):
        dataset = owned(request, pk)
        version = get_object_or_404(DatasetVersion, pk=version_id, dataset=dataset)
        if request.query_params.get("download") == "1":
            return FileResponse(
                io.BytesIO(version.csv_data.encode()),
                as_attachment=True,
                filename=f"dataset_{pk}_v{version.number}.csv",
                content_type="text/csv",
            )
        compare = request.query_params.get("compare")
        result = DatasetVersionSerializer(version).data
        if compare:
            other = get_object_or_404(DatasetVersion, pk=compare, dataset=dataset)
            before = quality(pd.read_csv(io.StringIO(other.csv_data)))
            after = quality(pd.read_csv(io.StringIO(version.csv_data)))
            result["comparison"] = {
                "from": other.number,
                "to": version.number,
                "before": before,
                "after": after,
                "delta": {key: after[key] - before[key] for key in before},
                "added_columns": sorted(
                    set(version.metadata["columns"]) - set(other.metadata["columns"])
                ),
                "removed_columns": sorted(
                    set(other.metadata["columns"]) - set(version.metadata["columns"])
                ),
            }
        return Response(result)

    def post(self, request, pk, version_id):
        try:
            with transaction.atomic():
                dataset = owned(request, pk, lock=True)
                current = ensure_original(dataset)
                if request.data.get("version_id") != current.pk:
                    return Response(
                        {
                            "error": "The active version changed. Refresh before restoring."
                        },
                        status=409,
                    )
                source = get_object_or_404(
                    DatasetVersion, pk=version_id, dataset=dataset
                )
                if source.pk == current.pk:
                    raise ValueError("This version is already active.")
                if request.data.get("confirm") is not True:
                    raise ValueError("Confirm restoring this version.")
                restored = create_version(
                    dataset,
                    source.csv_data,
                    source.metadata,
                    f"Restore version {source.number}",
                    {"action": "restore", "source_version_id": source.pk},
                )
            return Response(DatasetVersionSerializer(restored).data, status=201)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)


class TrainingView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "training"
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .ml.experiments import run_experiment
        from .serializers import ModelRecordSerializer

        dataset = owned(request, request.data.get("dataset_id"))
        target = request.data.get("target_column")
        if not isinstance(target, str):
            return Response({"error": "Choose a target column."}, status=400)
        # An atomic database lease prevents duplicates across Gunicorn workers,
        # including deployments without Redis. Expire abandoned requests after 5 min.
        from django.db.models import Q

        started = timezone.now()
        acquired = (
            Dataset.objects.filter(pk=dataset.pk)
            .filter(
                Q(training_started_at__isnull=True)
                | Q(training_started_at__lt=started - timedelta(minutes=5))
            )
            .update(training_started_at=started)
        )
        if not acquired:
            return Response(
                {"error": "A training request is already running for this dataset."},
                status=409,
            )
        try:
            record = run_experiment(
                dataset.pk,
                request.user.pk,
                target,
                request.data.get("task"),
                request.data.get("version_id"),
            )
            return Response(ModelRecordSerializer(record).data, status=201)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        finally:
            Dataset.objects.filter(pk=dataset.pk, training_started_at=started).update(
                training_started_at=None
            )


class InsightsView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "insights"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SavedInsight.objects.filter(user=request.user).select_related(
            "dataset", "dataset_version"
        )
        if request.query_params.get("dataset_id"):
            dataset = owned(request, request.query_params["dataset_id"])
            qs = qs.filter(dataset=dataset)
        return paginated(request, qs, SavedInsightSerializer)

    def post(self, request):
        from .insights import interpret_question, execute_plan

        try:
            with transaction.atomic():
                dataset = owned(request, request.data.get("dataset_id"), lock=True)
                version = ensure_original(dataset)
                if request.data.get("version_id") != version.pk:
                    return Response(
                        {
                            "error": "The dataset changed. Refresh and generate this insight again."
                        },
                        status=409,
                    )
                # Save recomputes the plan on the immutable source; client charts and
                # interpretations are never trusted as measured evidence.
                text, version_id = version.csv_data, version.pk
            frame = pd.read_csv(io.StringIO(text))
            question = request.data.get("question")
            if (
                not isinstance(question, str)
                or not question.strip()
                or len(question) > 2000
            ):
                raise ValueError("Ask a question between 1 and 2,000 characters.")
            if request.data.get("save") is True:
                plan, planner = request.data.get("plan"), "validated saved plan"
            else:
                plan, planner = interpret_question(question, frame)
            result = execute_plan(frame, plan)
            payload = {
                "question": question,
                "plan": plan,
                "result": result,
                "interpretation": result["interpretation"],
                "dataset_version": version_id,
                "version_number": version.number,
                "planner": planner,
            }
            if request.data.get("save") is True:
                saved = SavedInsight.objects.create(
                    user=request.user,
                    dataset=dataset,
                    dataset_version=version,
                    question=question,
                    plan=plan,
                    result=result,
                    interpretation=result["interpretation"],
                )
                payload = SavedInsightSerializer(saved).data
            return Response(
                payload, status=201 if request.data.get("save") is True else 200
            )
        except (ValueError, TypeError) as exc:
            return Response({"error": str(exc)}, status=400)


class InsightDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        saved = get_object_or_404(
            SavedInsight.objects.select_related("dataset", "dataset_version"),
            pk=pk,
            user=request.user,
        )
        return Response(SavedInsightSerializer(saved).data)

    def delete(self, request, pk):
        saved = get_object_or_404(SavedInsight, pk=pk, user=request.user)
        saved.delete()
        return Response(status=204)
