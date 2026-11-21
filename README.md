# Autonomous Data Scientist

A private dataset workspace built with React/Vite and Django. Upload a CSV,
inspect measured data quality, preview cleaning changes, compare fitted models,
run predictions, save analytical insights, and export your results.

The application uses a light, responsive sidebar layout. Dataset workspaces keep
exploration, cleaning, training, predictions, Insight Studio, the conversational
analyst, exports, and immutable versions together. See [DESIGN.md](DESIGN.md).

## Implemented capabilities

- Email registration, JWT login, single-flight token refresh, protected routes,
  and per-user data isolation.
- CSV library with server search, sorting, filters, pagination, duplicate,
  download and confirmed deletion. Dataset detail loads directly by ID.
- Real schema, bounded previews, completeness, histograms, category frequencies,
  Pearson correlation, IQR outliers, and summary statistics.
- Cleaning preview and explicit confirmation. Every applied change creates a
  snapshot; versions can be inspected, compared, downloaded, and restored as a
  new snapshot. New uploads retain their original CSV as version 1.
- Classification and regression comparisons on a seeded holdout. Every fitted
  imputer, encoder, and scaler lives inside an sklearn pipeline fitted only to
  training rows. Models and insights retain their source version.
- Dynamic prediction forms, real class probabilities where supported, and
  numerical regression outputs. No invented confidence or local attribution.
- Insight Studio: validated analytical plans, deterministic pandas calculations,
  charts, source/filter/row-count evidence, and persistent saved insights.
  Simple questions work without an AI key. An optional Groq provider parses more
  complex questions into the same restricted plan schema; it never runs code.
- One dataset analyst with persisted, paginated history and Markdown. Groq is
  optional; unavailable-provider errors do not create successful conversations.
- Printable HTML analysis reports, CSV and model downloads, and FastAPI/Docker
  export bundles using the exact prediction implementation and scientific
  dependency versions used by the backend.

[Feature inventory and limits](docs/FEATURES.md) · [API reference](docs/API.md) ·
[Audit](docs/REVAMP_AUDIT.md) · [Executed checks and browser review](docs/TEST_RESULTS.md)

## Architecture

The validated backend uses Django 5.2.17 / DRF 3.18.2 and the constrained
Core/Groq/LangGraph stack. [Dependency audit](docs/DEPENDENCY_AUDIT.md) records
the explicit sklearn serialization-compatibility exception.

`frontend/src/pages/` owns route-level pages. `components/layout/` provides the
shell, `components/ui/` common controls, `components/charts/` bounded charts, and
`features/` the dataset workflows. `lib/api.js` owns authenticated requests,
refresh, pagination helpers, number formatting, and blob downloads. Workspace
sections and chart/Markdown bundles load lazily.

`backend/api/platform_views.py` handles version-aware dataset, training, and
insight workflows. `versions.py` owns immutable snapshots and cleaning;
`insights.py` validates and executes analytical plans; `ml/experiments.py` owns
holdout evaluation; `ml/preprocess.py` shares inference with deployment exports
and retains legacy bundle support. `views.py` retains auth, EDA, inference,
exports and chat. Agent tools are bound to an authenticated owner and dataset
before the LLM is called; there is no model-selectable dataset ID.

PostgreSQL is selected through `DATABASE_URL`; SQLite works locally. CSV snapshots
and model artifacts have database persistence for Render's ephemeral disk.
Redis caching is optional. Interactive training is synchronous and reports an
indeterminate running state; no queue or stage simulation is presented. The
Celery helper uses the same experiment service if invoked separately.

## Local setup

Use **Python 3.11** and **Node 22.12+**. Build a fresh backend environment
when upgrading from the previous dependency stack; removed packages should not
linger in the runtime. Keep sklearn serialization versions aligned
with the backend and exported requirements.

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
# Set a private SECRET_KEY in .env; DEBUG=True is local development only.
python manage.py migrate
python manage.py runserver
```

In another terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite. Defaults allow both `localhost:5173` and
`127.0.0.1:5173`; an existing `CORS_ALLOWED_ORIGINS` value overrides the defaults,
so include the exact origin you use. Do not place credentials in `VITE_*` values.
A fixture CSV is included at `docs/fixtures/retail-workflow.csv` for local checks;
it is explicitly test data, never automatically inserted into a real account.

## Environment

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Required with `DEBUG=False`; retain an existing deployment key |
| `DEBUG` | Defaults to `False`; set `True` only for local development |
| `DATABASE_URL` | PostgreSQL URL; absent uses local SQLite |
| `ALLOWED_HOSTS` | Comma-separated backend hostnames |
| `CORS_ALLOWED_ORIGINS` | Exact permitted frontend origins |
| `WEB_CONCURRENCY` | Optional Docker/Gunicorn worker count; defaults to 1 to bound memory |
| `MEDIA_ROOT` | Optional disk-cache directory; database backups remain authoritative |
| `GROQ_API_KEY` | Optional conversational analyst / complex insight planning |
| `GROQ_MODEL` | Optional provider model override |
| `REDIS_URL`, `USE_REDIS_CACHE` | Optional shared cache and shared throttle buckets |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CELERY_ALWAYS_EAGER` | Optional Celery configuration; no broker needed for interactive features |
| `VITE_API_URL` | Public backend base URL at frontend build time |

Upload and history limits are explicit server constants in `core/settings.py`
and match the upload UI. Change both if adapting these limits.

## Tests

The standard suites use isolated SQLite and mocked external AI services; no
provider keys, Redis, or PostgreSQL are required.

```bash
# From the repository root
backend/venv/bin/python backend/manage.py check --settings=core.test_settings
backend/venv/bin/python backend/manage.py test api --settings=core.test_settings
backend/venv/bin/python backend/manage.py makemigrations --check --dry-run --settings=core.test_settings

cd frontend
npm test
npm run lint
npm run build
npm audit --omit=dev
```

For optional standalone FastAPI export verification, install
`backend/requirements-dev.txt` in a separate Python 3.11 environment, then from
`backend/` run `python -m api.export_smoke /absolute/path/to/deployment.zip`.
Only validate a bundle you trust: serialized sklearn files are executable data.

## Deployment (Vercel / Render)

No production deployment or merge is performed by this revamp.

1. This includes a Django 4.2 → 5.2 dependency upgrade. Build a fresh backend
   environment from `requirements.txt` and `constraints.txt`; the new `STORAGES`
   configuration is included. Back up the production database and confirm `SECRET_KEY`, `DEBUG=False`,
   `DATABASE_URL`, `ALLOWED_HOSTS`, and frontend CORS origins are set. Preserve
   existing environment values; do not regenerate the existing secret casually.
2. On Render, install `backend/requirements.txt`, then run `python manage.py
   migrate --noinput` and `python manage.py collectstatic --noinput`. Migrations
   `0004` and `0005` are additive. They create snapshots/insights, nullable lineage
   and an expiring training lease. No account, dataset or model is reset.
3. Start `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 1
   --timeout 180`. Size workers to instance memory; interactive training occupies
   a worker. Redis and Celery workers are optional. Do not expose `/media/`
   through a public web server; downloads require authenticated API requests.
4. On Vercel, use root `frontend`, Node 22, `npm ci`, build `npm run build`,
   output `dist`, and set `VITE_API_URL` to the HTTPS Render origin. The existing
   `vercel.json` SPA fallback is retained. Deploy frontend and backend together:
   version-aware request bodies and training response shapes changed.
5. Smoke-test sign-in, upload, cleaning, a model run, inference, and export with a
   test account. Add `GROQ_API_KEY` only when enabling optional AI workflows.

Existing datasets receive an **imported baseline** snapshot on first detail,
version, cleaning, training or insight access. That baseline is the recoverable
CSV at upgrade time; previously overwritten uploads cannot be reconstructed.
Legacy models keep unknown lineage rather than receiving invented version IDs.
Historical metrics are preserved, not retroactively re-evaluated. Retraining
creates the new pipeline format.

## Limits and operational notes

The primary theme is light; a second theme was not introduced. CSVs are limited
to 10 MB, 100,000 rows and 100 columns. Interactive training uses at most 25,000
rows and a bounded encoded-feature budget. There are no unsupported AutoML,
cross-validation, SHAP, ROC, hosted deployment, or PDF-generation claims.

Browser tokens remain in localStorage to preserve the existing cross-origin JWT
architecture; HttpOnly refresh cookies and server-side logout revocation remain
future security work. TLS termination, production rate limiting, backups,
monitoring, and instance resource sizing remain operator responsibilities.
No PostgreSQL, Redis/Celery worker, or production migration was exercised locally.
Live provider answers require separately configured credentials; tests mock them.

The Python dependency audit retains one scoped sklearn advisory for historical
model compatibility; see [the rationale and remediation status](docs/DEPENDENCY_AUDIT.md).

For optional Docker Compose, set private `SECRET_KEY` and `POSTGRES_PASSWORD`
environment variables before starting. Use a URL-safe database password or adapt
the DATABASE_URL configuration accordingly; no fixed database password is bundled.
Legacy MD5 account hashes are accepted only for verification and automatically
upgraded after successful login. New passwords use the preferred strong hasher.
Historical disk-only model files that were already overwritten cannot be recovered
without a backup; database-backed historical records now retain correct artifacts.
