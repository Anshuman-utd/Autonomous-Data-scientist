# Delivered feature inventory

## Navigation and interface

Public: `/login`, `/register`. Protected: `/` (Overview), `/datasets`, `/models`,
`/insights`, `/account`, and `/workspace?dataset_id=<id>&tab=<section>`.
`/dashboard` redirects to Overview; `/upload` redirects to Datasets. Existing
workspace tab aliases (`explainability`, `explain`, `models`, `predictions`,
`reports`, `settings`, `explore`) resolve to their corresponding current sections.
The previously unreachable Upload/ModelTraining and duplicate floating chat
implementations were removed after confirming they had no reachable consumers.

A shared responsive sidebar, context bar, page header, buttons, badges, native
forms/selects, keyboard dialogs, tables, pagination, chart wrapper, empty/error
states and honest progress indicators underpin the screens. Native form controls
provide keyboard semantics. The mobile navigation hides offscreen links, contains
focus while open and dismisses on Escape. Reduced-motion preferences are respected.

## Dataset library and EDA

Server search, alphabetical/date sorting, recent/trained filters and pagination
operate across the complete library. Duplicate creates an independent dataset and
version 1. Existing filenames produce HTTP 409 instead of silently selecting an
old file. Deletion is explicit and cascades through the owned dataset graph.

Uploads: UTF-8 (BOM accepted), `.csv` case-insensitively, at most 10 MB, 100,000
rows and 100 columns; non-empty data, unique non-empty headers, consistent record
widths, column names at most 200 characters and proper quoting are required. Invalid encodings are rejected rather
than silently stripped. Python's CSV parser also rejects excessively large cells.

Metadata contains actual pandas dtypes, missing counts, distinct counts and the
first 20 records. Numerical histograms use 10 bins; categorical frequencies show
the top 10 observed categories. Correlation is Pearson; constants have undefined
correlation rather than a fabricated zero. The UI bounds the matrix to 15 numeric
columns. IQR bounds and counts identify unusual values without asserting errors.
Schema information is independent of missing-value statistics.

## Cleaning and Dataset Version History

Operations: numeric mean/median/zero/mode imputation, categorical mode imputation,
dropping missing rows, duplicate-row removal, IQR outlier-row removal for a chosen
numeric column, and column removal. Invalid type/strategy combinations fail.
No automatic label encoding or silent destructive cleaning occurs.

Preview computes actual before/after rows, columns, missing cells and duplicate
rows. It does not mutate the CSV. Confirmation and the expected active version ID
are required to apply. Every application records operation parameters, description,
timestamp, metadata and a complete immutable CSV snapshot. Active EDA is refreshed;
version-specific cache keys prevent stale results from another version.

Inspect, compare summary deltas and added/removed columns, download, and restore
are implemented. Restore creates another version, preserving current history.
Snapshots persist in SQLite/PostgreSQL. The active disk cache is reconstructible.

Retention is deliberately bounded: **20 snapshots and 100 MB of snapshot CSV text
per dataset**. At the limit, mutations are rejected with instructions to duplicate
the active dataset. No original or referenced history is silently pruned. Immutable
CSV versions use the existing database; no paid storage is introduced. Active CSV
backups and database overhead add to the snapshot budget, which is not an
account-wide quota.

New upload version 1 preserves the source CSV. Existing datasets are initialized
lazily from the CSV available at upgrade, explicitly named “Imported baseline
(pre-version history)”. Earlier destructive overwrites cannot be recovered.
Legacy model versions remain null/unknown. New models and insights reference a
real snapshot; historical results are visibly marked when active data changes.

## Training, explanation and predictions

Up to six classification candidates: logistic regression, random forest,
decision tree, SVM, KNN, Gaussian Naive Bayes. Five regression candidates: linear
regression, random forest, decision tree, SVR, KNN. SVM uses a linear variant above
2,000 training rows. Tree candidates cap depth at 12 and leaves at 256. Candidates run sequentially to bound memory; failed candidates
are recorded and omitted from the leaderboard.

Task detection uses target dtype and distinct values (integer targets with fewer
than 20 values default to classification); users can override it. At least 10
known-target rows, one feature, and two classification classes with at least two
examples each are required. Missing target rows are excluded, never imputed.
Classification supports at most 100 target classes. Categorical features have at
most 100 values each. Training has a 25,000-row, 512-encoded-feature and 5-million
row-feature-cell budget. Resource-heavy inputs fail descriptively.

A deterministic 80/20 holdout (seed 42) is adjusted for stratification and minimum
class coverage. Fitted preprocessing belongs to sklearn Pipelines /
ColumnTransformer: median numeric imputation, numeric scaling, categorical mode
imputation and unknown-tolerant one-hot encoding. Only training rows fit these
transforms. All-missing numeric columns and unseen prediction categories work.

Real accuracy, weighted F1/precision/recall, labelled confusion matrices, R², RMSE,
MAE, fit duration and per-row prediction time are recorded. Selection is highest
accuracy or R² among candidates on the same holdout. This is a model-selection
holdout, not an independent final test; there is no cross-validation or tuning
claim. Evaluation is conditional on the uploaded/cleaned snapshot; data-dependent
cleaning done before splitting can influence estimates. Use the original snapshot
when evaluating the pipeline’s own fitted imputation without prior cleaning. ROC curves are omitted. Importance is explicitly labelled as impurity
importance or absolute coefficients with numeric inputs standardized; unsupported
models show no importance. No SHAP or per-prediction attribution is invented.

Training is synchronous, uses an atomic expiring database lease to reject
concurrent submissions across workers, and shows indeterminate progress. There is
no browser timer manufacturing stages and no queue-status UI. An abandoned lease
expires after five minutes. The optional Celery task calls the same experiment
service; interactive routes do not require a worker.

Predictions choose a historical model, load its original input schema, validate
numeric values, reset safely on model changes, and use the serialized fitted
pipeline. Reset and random scenarios are supported. Random combinations are not
claimed to be observed examples. Classification probabilities are shown only when
the estimator exposes them, without calibration guarantees. Regression shows a
numerical prediction and no invented uncertainty interval.

## Insight Studio

A bounded deterministic parser supports simple exact-column questions such as:

- `Show average revenue by region`
- `Show top 10 region by count`
- `Show the distribution of revenue`

More complex questions can use Groq to propose a JSON plan from schema only.
Plans are validated regardless of origin. Supported operations: count, sum, mean,
median, min, max, histogram and scatter; optional grouping, up to five scalar/list
filters (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`), ascending/descending sorting,
top N, and day/week/month/year grouping on valid dates. Invalid column references,
unsupported fields/operations, incompatible types, invalid dates, unsuitable chart
choices and empty results fail explicitly. Grouped histograms/scatter are not
supported. No Python, SQL, shell, eval or generated expression is executed.

Results support bar, line, area, histogram, scatter, summary-table and KPI displays
where appropriate. Aggregation output is at most 50 groups; histograms at most 20
bins; scatter at most 500 reproducibly sampled complete pairs. Evidence records
source columns, filters, aggregation, date interval, matched/source/used row counts,
and returned point count. The interpretation is a deterministic summary of the
computed result, preventing invented LLM numerical claims.

Save recomputes a validated plan on the expected immutable version. It never
trusts client-submitted chart values or explanation text. Saved results retain
user, dataset, version, question, plan, computed chart/evidence, interpretation and
creation time. They can be reopened and deleted, appear in workspace and global
collections, and are marked historical after source changes. Recent unsaved
questions are bounded to five within the current UI session. Persisted insights
are saved explicitly; an invalid/provider-failed request creates no fake result.

## Analyst, exports and security

The single analyst restores paginated history in chronological display order and
supports safe Markdown (no remote image requests or raw HTML), suggested prompts, loading and retrying an unsent question.
Missing/failed provider requests return 503 and do not persist a successful answer.
Agent tools have no dataset-ID argument: owner and dataset are bound outside the
LLM; every tool lookup rechecks the owner. Dataset content is labelled untrusted.

Reports are escaped HTML, printable to PDF, limited to the selected model's source
version. There is no server PDF renderer. Exports use authenticated blobs, never
query JWTs. The FastAPI ZIP includes the exact inference source, model bundle,
scientific dependency versions, requirements, Dockerfile and README. It does not
publish a cloud service. The exported service needs operator-configured access
controls and TLS before public exposure.

Private media is no longer served through DEBUG URL routes. All resource endpoints
check ownership. Registration validates email/passwords; default production DEBUG
is false and SECRET_KEY is required. New password hashes use Django’s strong preferred hasher. MD5 is retained only
as a legacy verifier, and successful logins transparently upgrade those hashes. Training leases work without Redis. Per-scope auth/upload/training/insight/
chat throttles bound request rates; LocMem throttle buckets are per process, with
Redis providing a shared optional cache. Tokens are still browser localStorage
JWTs, without HttpOnly refresh cookies or server logout revocation.

## Explicit verification limits

Live provider success, PostgreSQL locking, Redis cache behavior, Celery workers,
Docker image builds, production migrations, and hosting were not exercised.
Browser workflows were tested through the provided browser/Playwright-equivalent
tooling; there is no dedicated Playwright CI runner in this repository. Automated
Django and Vitest suites are repeatable and mock external AI services. See
TEST_RESULTS.md for commands, counts, screenshots and any dependency audit findings.

Dependency refresh: Django 5.2.17 / DRF 3.18.2 and constrained AI dependencies
were validated in a fresh Python 3.11 environment. The scoped sklearn advisory
exception is detailed in DEPENDENCY_AUDIT.md; the backend audit is not advertised
as having zero findings.

Historical model artifacts prefer their record-specific database bytes over a
possibly reused legacy disk path. New filenames are unique. Already-overwritten
historical disk-only artifacts without a database backup cannot be reconstructed.
