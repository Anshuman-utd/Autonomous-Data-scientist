# Platform revamp audit

Audit date: 2026-11-21. Branch: `codex/platform-revamp`.

## Confirmed baseline

React 19/Vite 8, Tailwind 3, React Router 7, Recharts; Django 4.2/DRF,
SimpleJWT, pandas/sklearn 1.4.2, LangGraph/Groq. SQLite locally, PostgreSQL
via DATABASE_URL. Redis caching and Celery are optional. CSV/model database
backups support ephemeral Render disks. No meaningful automated tests existed.

Routes: `/login`, `/register`, `/`, `/dashboard`, `/workspace?dataset_id=&tab=`.
Upload and ModelTraining pages were unreachable. Workspace contained overview,
EDA, simulated training, predictions, explainability, chat, exports and settings
in one 1,224-line module. FloatingChat was a second chat implementation.
Shared components covered cards, buttons, badges, inputs, modals and skeletons;
charts, cleaning, predictions and deployment each had separate presentation.

API: register/login/refresh; upload; paginated datasets/models/chat; dataset
DELETE/POST duplicate; transform; eda; train; predict; model-schema;
download-dataset/model; export-report/deployment. Dataset detail GET was absent.
Every main API consumer manually constructed authentication headers.

## Priorities and evidence

- P0: agent/tools.py queried Dataset by ID without owner scope. Prompts were the
  only constraint. Workflow also looked up an unscoped dataset.
- P0: core/urls.py exposed private media directly in DEBUG; settings defaulted to
  DEBUG and used MD5 password hashes for development; query JWT downloads leaked
  credentials into URLs. Production secrets had an insecure fallback.
- P1: preprocess.py fitted imputers/encoders/scaler on all data before train.py
  split. Missing targets were imputed or converted to labels. Noncontiguous
  numeric class labels were decoded as indices. Missing probabilities became 88.5%.
- P1: evaluation used invented latency and uniform importance fallback. Workspace
  generated synthetic ROC/confusion charts and timed training stages.
- P1: Dashboard loaded just one page, estimated storage as datasets × 1.4MB.
  Workspace searched that first page instead of requesting dataset detail.
- P1: upload ignored UTF-8 errors and silently resumed files sharing a filename.
  No file size/row/column limits; cleaning overwrote the only recoverable CSV.
- P1: auth discarded sessions on any 401, ignored refresh tokens. Chat didn't
  restore its persisted history; FloatingChat expected an unpaginated response.
- P2: report mixed runs/versions/targets; deployment duplicated inference code;
  filenames reused model paths, risking overwriting historical artifacts.
- P2: dark surfaces, gradients, tiny text, promotional hero and nested cards
  obscured the workflow. Modal lacked focus containment and keyboard dismissal.

## Implementation decisions

Light semantic tokens; compact responsive sidebar shell; bounded tables and
selectable chart columns. Preserve existing route aliases. One persisted analyst
experience; no synthetic metrics. Authenticated blob downloads and single-flight
refresh. Keep synchronous training honest and Redis optional. Split before any
fitted transform and serialize sklearn pipelines. Validate structured analytics
with bounded deterministic pandas operations; never execute generated code.
Store immutable CSV versions in the existing database, with an explicit bound,
optimistic version checks, original recovery and model/insight lineage.

Implementation details and outstanding limits are recorded in FEATURES.md and
TEST_RESULTS.md. Public deployment is read-only; no production data is migrated
or changed by this work.

## Delivered changes

All reachable pages now use the shared light shell and primitives. Dataset detail
and complete pagination replace list-search navigation; summaries use actual
counts (unknown legacy row totals remain null). Upload validates content and
rejects filename conflicts. The extracted feature modules cover EDA, cleaning,
experiments, predictions, persisted analyst, Insight Studio, exports and versions.
Synthetic charts/progress/confidence/storage and unsupported importance fallbacks
were removed. The original unused train/preprocess/evaluation paths and duplicate
chat components were removed after verifying no remaining consumers.

New database models and additive migrations persist versions, insights, source
lineage and an expiring cross-worker training lease. Cleaning/restore are version
checked. Pipelines split before all fitted transforms. Exported inference shares
the server implementation. Owner-bound AI tools have no model-selected IDs, run
on the request thread and bound their result/sample sizes. Query JWTs, direct
media serving, MD5-first hashing and unsafe report interpolation were removed. Legacy MD5 is
retained only as a last-resort verifier, with automatic strong rehashing on login.

Both JavaScript and Python dependency audits were executed. A fresh, constrained
Django 5.2 / DRF 3.18 / Core-Groq-LangGraph runtime was validated; unused AI
integrations were removed. One explicit sklearn compatibility exception remains
(DEPENDENCY_AUDIT.md). Docker excludes local data/environments/secrets.

Final evidence: 36 backend tests, 21 frontend tests, 19 Gunicorn HTTP checks,
exported ASGI endpoint checks, static collection, migration drift checks, frontend
build/lint and responsive browser review. Live provider success and production
infrastructure remain untested; details are in TEST_RESULTS.md.
