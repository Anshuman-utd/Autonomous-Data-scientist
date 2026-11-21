# API reference

Base URL: `<backend-origin>/api`. Routes have no trailing slash. Protected routes
require `Authorization: Bearer <access>`; JWT query parameters are not accepted.
Errors use `error` (application) or `detail` (DRF/JWT). Lists return
`{count, next, previous, results}`; `page`, `page_size` (max 100) are supported.
Dataset versions are bounded to 20 and returned together.

## Authentication

| Method | Route | Body / result |
| --- | --- | --- |
| POST | `/register` | `{full_name,email,password,confirm_password}` → 201 |
| POST | `/login` | `{email,password}` → `{access,refresh,user}` |
| POST | `/token/refresh` | `{refresh}` → `{access}` |

Email and Django password validators apply. Auth requests are scoped to 10/minute.
The SPA stores access/refresh tokens and retries an unauthorized request once
through a shared refresh operation. Logout clears browser credentials; it does
not revoke an already-issued token on the server.

## Datasets

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/summary` | Whole-account measured counts and recent runs/insights; records is null when legacy totals are unavailable |
| POST | `/upload` | multipart `file`; CSV validation; returns 201 `{dataset_id,columns,preview,version}`; duplicate filename → 409 |
| GET | `/datasets` | Paginated library; `search`, `ordering=name/-name/uploaded_at/-uploaded_at`, `filter=all/recent/trained`; compact metadata |
| GET | `/datasets/{id}` | Full owned dataset metadata, `active_version`, `active_version_number` |
| POST | `/datasets/{id}` | Duplicate into independent dataset and history; 201 |
| DELETE | `/datasets/{id}` | Confirm in UI; delete owned dataset graph; 204 |
| GET | `/eda?dataset_id={id}` | Cached real EDA for the selected dataset/version |
| GET | `/download-dataset?dataset_id={id}` | Authenticated active CSV attachment |

Upload limits: 10 MB, 100k rows, 100 columns, UTF-8, unique/non-empty header,
consistent record width. Upload scope: 20/hour.

## Cleaning and versions

`POST /datasets/{id}/transform` previews or applies one operation:

```json
{
  "action": "impute_missing",
  "column": "revenue",
  "strategy": "median",
  "version_id": 7,
  "preview": true
}
```

`version_id` is the snapshot's **database ID**, not its displayed version number.
Supported actions: `impute_missing`, `remove_duplicates`, `remove_outliers`,
`drop_columns` (uses `columns: ["name"]`). Strategies:
`median/mean/mode/zero/drop`, constrained by dtype. Response includes `before`,
`after`, `preview`, `description`, and `source_version_id`.

After user confirmation, send the same operation with `preview:false` and
`confirm:true`. Returns the new `version`, updated `eda_report` and `columns`.
An unexpected active version returns 409; invalid/no-op operations return 400.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/datasets/{id}/versions` | `{results,limit}`; metadata, operation, description, active marker |
| GET | `/datasets/{id}/versions/{version_id}` | Inspect snapshot details |
| GET | same + `?compare={other_version_id}` | Compare row/column/missing/duplicate deltas and column additions/removals |
| GET | same + `?download=1` | Snapshot CSV attachment |
| POST | same | `{version_id:<expected active ID>,confirm:true}` restores selected snapshot as another version; 201 |

At 20 snapshots or 100 MB of snapshot CSV text, further mutations return 400.
No snapshot pruning occurs. Duplicate active data to start an independent history.

## Models and inference

`POST /train`:

```json
{"dataset_id":42,"version_id":7,"target_column":"retained","task":"auto"}
```

`task` may be `auto`, `classification`, or `regression`. The synchronous response
is 201 and contains the full serialized ModelRecord, including `id`,
`dataset_version`, `dataset_version_number`, `model_name`, `accuracy` (legacy
field name holding the primary score), and `metrics` with:

- `problem_type`, `target_column`, `target_classes`, `features`, `schema_info`.
- `all_results`: real candidate metrics, confusion matrices/classes where applicable,
  fit duration and per-row prediction time.
- `evaluation`: method, seed, split sizes, missing-target exclusions and selection rule.
- `feature_importance`, `feature_importance_method`, `failed_candidates`.

Current training is a seeded holdout comparison, without tuning or cross-validation.
The UI must not format regression's primary score as an accuracy percentage.
An atomic database lease rejects duplicate requests (409); abandoned leases expire
after five minutes. Scope: 12 training requests/hour. Training errors return 400.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/models` | Paginated owned runs; optional `dataset_id` |
| GET | `/model-schema?model_id={id}` | Original feature schema and model metadata |
| POST | `/predict` | `{model_id,inputs:{feature:value}}` → actual prediction, optional class probabilities/confidence and source version ID |
| GET | `/download-model?model_id={id}` | Serialized fitted model bundle |
| GET | `/export-deployment?model_id={id}` | ZIP with FastAPI app, shared predictor, artifact, requirements, Dockerfile, README |
| GET | `/export-report?dataset_id={id}&model_id={id}&download=1` | Escaped printable HTML attachment; explicit model must belong to selected dataset |

Model source versions stay immutable even after cleaning/restoring active data.
Legacy model lineage is null and is never fabricated. For new bundles, prediction
requires exactly the model's fields and finite numeric values. No uncertainty
interval is returned for regression. Classification confidence is absent when the
estimator has no probabilities.

## Insight Studio

`POST /insights` generates an unsaved result:

```json
{"dataset_id":42,"version_id":7,"question":"Show average revenue by region"}
```

Response: `question`, validated `plan`, `result` (chart, data, evidence),
`interpretation`, `dataset_version`, `version_number`, `planner`.
Simple exact-column questions work offline. Optional Groq planning receives only
schema. Invalid/missing-provider/unsupported requests return descriptive 400 errors.
No generated code or expressions are executed.

A plan uses `operation`, optional `group_by/value/x/y`, `filters`, `sort`, `limit`,
`interval`, and compatible `chart`. Operations: count/sum/mean/median/min/max/
histogram/scatter. At most five filters, 50 output groups, 20 bins or 500 scatter
points. Date intervals: day/week/month/year. Evidence includes columns, aggregation,
filters, matched/used/source rows, interval and output count.

Save with the original expected source version; the server recomputes the values:

```json
{
  "dataset_id":42,"version_id":7,"question":"Show average revenue by region",
  "save":true,
  "plan":{"operation":"mean","group_by":"region","value":"revenue","sort":"desc","limit":20}
}
```

Returns 201 SavedInsight. Client chart values and interpretations are ignored.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/insights` | Paginated saved insights; optional `dataset_id` |
| GET | `/insights/{id}` | Full result, source version and `stale` status |
| DELETE | `/insights/{id}` | Confirm in UI; remove saved insight; 204 |

Insight scope: 120 requests/hour. All retrieval, generation, saving and deletion
are owner-scoped; cross-user resources return 404.

## Analyst

- `GET /chat?dataset_id={id}&page=1` returns newest exchanges first. The SPA reverses
  loaded results for chronological display and can load earlier pages.
- `POST /chat` with `{dataset_id,question}` runs the owner-bound LangGraph analyst,
  persists the successful exchange and returns `{answer,created_at}`.
- Questions are bounded to 4,000 characters; provider failures/missing keys return
  503 without a persisted successful answer. Scope: 60 requests/hour.

## Compatibility notes

Old authenticated paths are retained. Request/response changes intentionally remove
misleading behavior: upload conflicts are now 409; training returns a ModelRecord;
mutations require explicit confirmation and source version; chat pagination is
newest-first; direct private media and query JWT downloads are removed. Deploy
frontend and backend together. Redis is optional; its absence does not disable
interactive workflows. Shared throttling across processes requires a shared cache.
