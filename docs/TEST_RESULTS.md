# Executed validation — 2026-11-21

All statements below refer to local checks on `codex/platform-revamp`.
No production deployment, production migration, merge, or remote account mutation
was performed. A separate `/tmp/autonomous-revamp-qa.sqlite3` and temporary media
directory were used for browser QA; the existing workspace database was untouched.

## Automated checks

| Command (from repository root unless stated) | Actual result |
| --- | --- |
| `/tmp/revamp-validated-backend/bin/python backend/manage.py check --settings=core.test_settings` | Passed; no issues |
| `/tmp/revamp-validated-backend/bin/python backend/manage.py makemigrations --check --dry-run --settings=core.test_settings` | Passed; no model drift |
| `/tmp/revamp-validated-backend/bin/python backend/manage.py test api --settings=core.test_settings` | 36 tests passed |
| `npm test` in frontend | 21 tests passed across 2 files |
| `npm run lint` in frontend | Passed |
| `npm run build` in frontend | Passed; workspace sections split into lazy chunks; no oversized-chunk warning |
| `npm audit --omit=dev` in frontend | 0 vulnerabilities after compatible dependency updates |
| `/tmp/revamp-validated-backend/bin/python -m pip check` | No broken requirements |
| `git diff --check` | Passed |
| Fresh `pip install -r backend/requirements.txt` and constrained dry-run | Passed |
| Full installed-tree Python dependency audit | 2 feed entries for one scoped sklearn advisory; intentionally exits 1 (see DEPENDENCY_AUDIT.md) |
| `collectstatic --noinput --settings=core.test_settings` in fresh runtime | 154 files copied, 444 post-processed |
| `QA_EMAIL=… QA_PASSWORD=… PYTHONPATH=backend /tmp/revamp-validated-backend/bin/python -m api.http_smoke` | 19 HTTP checks passed under Gunicorn 23 / DEBUG=False; fixture dataset removed |
| Migrate isolated QA SQLite database through `0004` and `0005` | Passed |
| Export smoke test with optional FastAPI/httpx in an isolated `/tmp` library directory | `/health` 200; `/predict` 200; exact match with original predictor |

The export command used was:

```bash
PYTHONPATH=/tmp/revamp-export-deps:backend backend/venv/bin/python \
  -m api.export_smoke /Users/anshumanmehta/Downloads/deployment_4.zip
```

The returned source snapshot ID was 5 (displayed dataset version 3). Database
snapshot IDs and per-dataset version numbers are intentionally different.

The final Django checks use a fresh Python 3.11 environment with Django 5.2.17 /
DRF 3.18.2. The older workspace virtual environment was left intact. The Django
test suite covers registration/login/refresh, protected access,
query-token rejection, malformed/empty/encoding/size/column-limit CSVs, filename
conflicts, complete pagination/detail, duplication/deletion/downloads, mixed and
categorical EDA, missing/constant columns, cache invalidation, preview integrity,
confirmation/type/stale-version checks, bounded history, restore/compare/download,
ephemeral-file recovery, classification/regression, real confusion-matrix counts,
noncontiguous class labels, train-only preprocessing, missing targets, small and
single-class inputs, all-missing and boolean features, unseen categories, pipeline
persistence/export parity, historical lineage, escaped reports, cross-user model/
version/insight/tool authorization, structured analytics and limits, offline/failed/
invalid/mocked AI planning, save/retrieve/delete/stale insights, chat history and
provider failure, duplicate training leases, honest legacy summary totals, legacy MD5-to-PBKDF2 account migration, historical artifact identity despite a reused
disk path, and actual analyst graph dispatch with an owner-bound
tool and mocked external provider.

Vitest covers auth forms and password visibility, upload validation/success,
dashboard counts/navigation/pagination, direct dataset detail loading, workspace
sections, cleaning preview/confirmation, indeterminate training, empty prediction
states, prediction reset on model switching, insight generation/save/error,
persisted Markdown chat, recoverable empty/error states, concurrent single-flight
refresh, invalid refresh, network failure, failed login logout-during-refresh, and blocking remote images in untrusted analyst Markdown.

One NumPy warning for a deliberately all-missing numeric fixture remains benign;
its assertions pass. The optional export check emitted a Starlette deprecation
warning about httpx, while both endpoint assertions passed.

## Browser and visual verification

Inspected the public deployment's unauthenticated login page as the before-state.
No production credentials were entered. Existing authenticated production pages
were not inspected.

Local browser checks used the provided browser/Playwright-equivalent control,
backed by the real local Django API. There were no stubbed analytics responses.
Fixture datasets were clearly named `*-qa.csv` and generated real EDA/training
results; `docs/fixtures/retail-workflow.csv` was also uploaded through the actual
file chooser and UI.

Observed working:

1. Existing QA account login, authenticated overview, library and direct dataset navigation.
2. New local account registration, automatic login, zero-data empty states, logout.
3. File chooser upload → immediate navigation to the uploaded dataset workspace.
4. EDA distributions, category counts, missing-cell chart and statistical table.
5. Cleaning preview showing actual before/after counts; explicit application → v2.
6. Version comparison and original restoration → v3, with prior snapshots preserved.
7. Historical v1 model warning after restoring; a new real v3 training run with all
   six classification candidates and measured metrics/confusion matrix.
8. Live prediction with actual class probabilities from the selected fitted model.
9. Offline grounded mean-by-region insight, save, and persisted version indicators.
10. Analyst unavailable-provider feedback without a fabricated successful answer.
11. Authenticated HTML and deployment ZIP browser downloads. The HTML was checked
    for measured evaluation and feature sections; ZIP contents and Python syntax
    were checked, then the exported ASGI endpoints were exercised separately.
12. Mobile navigation, recovery from an interrupted local API request, contained
    horizontal tables/tabs and long-filename wrapping.

Widths reviewed: **1440, 1024, 768, 390 and 320px**. DOM width checks showed page
scroll widths equal to viewport widths at 1024/768/390/320px. Wide data stays within
scrolling tables and tabs. At 320px the long filename wraps inside the heading;
context-bar text truncates to preserve navigation/logout targets.

Screenshots:

- `screenshots/overview-desktop.jpg`
- `screenshots/explore-desktop.jpg`
- `screenshots/training-desktop.jpg`
- `screenshots/insights-desktop.jpg`
- `screenshots/versions-desktop.jpg`
- `screenshots/workspace-mobile.jpg`
- `screenshots/workspace-tablet.jpg`
- `screenshots/exports-narrow.jpg`
- `screenshots/long-filename-320.jpg`
- `screenshots/login-desktop.jpg`
- `screenshots/empty-workspace-desktop.jpg`

## Failures discovered and resolved

- Initial ESLint checks found unused legacy imports and JSX identifier handling;
  obsolete components were removed and the existing unused-variable rule adjusted
  for uppercase JSX component arguments. Final lint passes.
- First frontend test run: 14/15 passed; an insight assertion matched both a chart
  and its hidden underlying-data table. The assertion was corrected, then all
  component and newly added refresh tests passed (20 total).
- Initial npm audit found vulnerable installed frontend packages. Compatible
  updates were applied to the lockfile; final audit reports zero vulnerabilities.
- Local browser login initially failed because an existing CORS environment value
  allowed localhost but not 127.0.0.1. QA used an explicit origin list; documented
  defaults now include both. The actual environment file was not overwritten.
- Initial build warned about a large combined workspace chunk. Feature sections
  were changed to lazy imports; final build has no oversized-chunk warning.

## Not verified / limitations

- No live Groq success request was made. Standard tests mock providers; real browser
  checks verified offline insight generation and honest analyst failure behavior.
- SQLite was exercised, not a live PostgreSQL server or concurrent PostgreSQL lock
  stress test. Redis/Celery worker paths and cache outage behavior were not exercised.
- No Docker image build, Render deploy, Vercel deploy or production migration.
- Browser checks preceded the dependency refresh; final API and graph tests plus
19 real HTTP checks were repeated on the upgraded runtime. Browser workflows were executed with the session browser tooling. A dedicated
  Playwright CI test runner was not added; repeatable automated suites are Django
  and Vitest. Screenshots are reviewed evidence, not pixel-diff tests.
- No load test, WCAG certification, screen-reader audit or calibrated probability
  assessment. Standard focus/label/dialog behavior and responsive layouts were reviewed.
- Refresh credentials remain in localStorage, and logout has no server revocation.
- Legacy overwritten source data and original training methodology cannot be
  reconstructed; legacy lineage remains unknown and prior metrics are preserved.


## Dependency upgrade regression checks

An initial candidate AI package set failed dependency resolution, then an
intermediate graph/prebuilt pair failed an import check. The final compatible
versions were installed and frozen into constraints. A new graph test exposed
threaded database tools opening a separate transaction/connection; moving the
bounded tool dispatcher onto the request thread resolved it. Final tests pass.

A default unlabeled Django discovery command from the repository root discovered
zero tests; it is not counted as validation. The documented `test api` command
explicitly discovers and runs the 36 app tests.

The optional HTTP runner refuses non-local hostnames and requires credentials for
an account in a disposable local database. It covers upload, detail, EDA,
non-destructive preview, versioned apply, all six classification candidates,
schema/inference, insight generation/save/retrieval/staleness, restore, HTML/ZIP/
version CSV exports, missing-provider error, and deletion of its own fixture data.
No paid provider is used. The upgraded Gunicorn server used an isolated QA database.


Final compatibility review also added a regression test for legacy MD5-hashed
accounts: login verifies the old hash and transparently upgrades it to PBKDF2.
Another test verifies that valid but incorrect bytes at a reused legacy disk path
cannot replace a model's database artifact in predictions/downloads/exports.
The final frontend suite contains 21 tests, including untrusted Markdown image
blocking; the final backend suite contains 36 tests.
