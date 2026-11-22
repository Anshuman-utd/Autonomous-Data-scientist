# Changed files

> Historical revamp record (2026-11-21). The maintainer reports this work subsequently merged into main and deployed. Statements about actions not taken refer to that original session.

Work is maintained on `codex/platform-revamp`; see Git history for focused commits. No production merge or deployment was performed.
Removed frontend modules were replaced by the routed feature modules and shared primitives.
Removed legacy training code had no remaining consumers after pipeline integration.

## Frontend

- Modified: `frontend/Dockerfile`
- Modified: `frontend/README.md`
- Modified: `frontend/eslint.config.js`
- Modified: `frontend/index.html`
- Modified: `frontend/package-lock.json`
- Modified: `frontend/package.json`
- Removed/replaced: `frontend/src/App.css`
- Modified: `frontend/src/App.jsx`
- Removed/replaced: `frontend/src/components/CategoricalCharts.jsx`
- Removed/replaced: `frontend/src/components/CorrelationHeatmap.jsx`
- Removed/replaced: `frontend/src/components/DataPreview.jsx`
- Removed/replaced: `frontend/src/components/DeploymentExportTab.jsx`
- Removed/replaced: `frontend/src/components/DistributionCharts.jsx`
- Removed/replaced: `frontend/src/components/FeatureImportanceChart.jsx`
- Removed/replaced: `frontend/src/components/FileUpload.jsx`
- Removed/replaced: `frontend/src/components/FloatingChat.jsx`
- Removed/replaced: `frontend/src/components/MissingValuesChart.jsx`
- Removed/replaced: `frontend/src/components/ModelComparisonTable.jsx`
- Removed/replaced: `frontend/src/components/OutliersSection.jsx`
- Removed/replaced: `frontend/src/components/OverviewCards.jsx`
- Removed/replaced: `frontend/src/components/PredictionPlayground.jsx`
- Removed/replaced: `frontend/src/components/SmartCleaningSection.jsx`
- Removed/replaced: `frontend/src/components/ui/Badge.jsx`
- Modified: `frontend/src/components/ui/Button.jsx`
- Removed/replaced: `frontend/src/components/ui/Card.jsx`
- Removed/replaced: `frontend/src/components/ui/EmptyState.jsx`
- Removed/replaced: `frontend/src/components/ui/Input.jsx`
- Modified: `frontend/src/components/ui/Modal.jsx`
- Removed/replaced: `frontend/src/components/ui/Skeleton.jsx`
- Removed/replaced: `frontend/src/components/ui/StatCard.jsx`
- Modified: `frontend/src/config/api.js`
- Modified: `frontend/src/context/AuthContext.jsx`
- Modified: `frontend/src/index.css`
- Modified: `frontend/src/main.jsx`
- Modified: `frontend/src/pages/Auth.jsx`
- Modified: `frontend/src/pages/Dashboard.jsx`
- Removed/replaced: `frontend/src/pages/ModelTraining.jsx`
- Removed/replaced: `frontend/src/pages/Upload.jsx`
- Modified: `frontend/src/pages/Workspace.jsx`
- Modified: `frontend/tailwind.config.js`
- Modified: `frontend/vite.config.js`
- Added: `frontend/.dockerignore`
- Added: `frontend/.env.example`
- Added: `frontend/src/components/charts/ResultChart.jsx`
- Added: `frontend/src/components/layout/AppShell.jsx`
- Added: `frontend/src/components/ui/Primitives.jsx`
- Added: `frontend/src/features/chat/Analyst.jsx`
- Added: `frontend/src/features/cleaning/Cleaning.jsx`
- Added: `frontend/src/features/datasets/UploadDialog.jsx`
- Added: `frontend/src/features/datasets/VersionHistory.jsx`
- Added: `frontend/src/features/eda/Explore.jsx`
- Added: `frontend/src/features/insights/InsightStudio.jsx`
- Added: `frontend/src/features/predictions/Predictions.jsx`
- Added: `frontend/src/features/reports/Exports.jsx`
- Added: `frontend/src/features/training/Training.jsx`
- Added: `frontend/src/lib/api.js`
- Added: `frontend/src/pages/Collection.jsx`
- Added: `frontend/src/test/api.test.js`
- Added: `frontend/src/test/setup.js`
- Added: `frontend/src/test/workflows.test.jsx`
- Added: `frontend/vitest.config.js`

## Backend

- Modified: `backend/.env.example`
- Modified: `backend/Dockerfile`
- Modified: `backend/api/agent/tools.py`
- Modified: `backend/api/agent/workflow.py`
- Modified: `backend/api/auth.py`
- Modified: `backend/api/ml/evaluate.py`
- Modified: `backend/api/ml/preprocess.py`
- Removed/replaced: `backend/api/ml/train.py`
- Modified: `backend/api/models.py`
- Modified: `backend/api/serializers.py`
- Modified: `backend/api/tasks.py`
- Modified: `backend/api/tests.py`
- Modified: `backend/api/urls.py`
- Modified: `backend/api/utils/eda.py`
- Modified: `backend/api/utils/report_generator.py`
- Modified: `backend/api/views.py`
- Modified: `backend/core/settings.py`
- Modified: `backend/core/urls.py`
- Modified: `backend/requirements.txt`
- Modified: `backend/test_chat.py`
- Modified: `backend/test_groq.py`
- Added: `backend/.dockerignore`
- Added: `backend/api/export_smoke.py`
- Added: `backend/api/http_smoke.py`
- Added: `backend/api/insights.py`
- Added: `backend/api/migrations/0004_datasetversion_savedinsight_dataset_active_version_and_more.py`
- Added: `backend/api/migrations/0005_dataset_training_started_at.py`
- Added: `backend/api/ml/experiments.py`
- Added: `backend/api/platform_views.py`
- Added: `backend/api/utils/artifacts.py`
- Added: `backend/api/utils/datasets.py`
- Added: `backend/api/versions.py`
- Added: `backend/constraints.txt`
- Added: `backend/core/test_settings.py`
- Added: `backend/requirements-dev.txt`

## Documentation and configuration

- Modified: `.gitignore`
- Modified: `DESIGN.md`
- Modified: `README.md`
- Modified: `docker-compose.yml`
- Added: `docs/API.md`
- Added: `docs/CHANGES.md`
- Added: `docs/DEPENDENCY_AUDIT.md`
- Added: `docs/FEATURES.md`
- Added: `docs/REVAMP_AUDIT.md`
- Added: `docs/TEST_RESULTS.md`
- Added: `docs/dependency-audit.json`
- Added: `docs/fixtures/retail-workflow.csv`

Responsive screenshot artifacts are listed in TEST_RESULTS.md.
