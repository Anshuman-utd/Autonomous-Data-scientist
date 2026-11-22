# Dependency audit — 2026-11-21

> Historical revamp record (2026-11-21). The maintainer reports this work subsequently merged into main and deployed. Statements about actions not taken refer to that original session.

## Executed checks

- Initial `npm audit`: installed frontend dependencies had 15 package findings.
  Compatible updates were applied; final `npm audit --omit=dev` reports **zero**.
- Initial Python direct-pin audit: 38 advisory entries in 10 packages (some
  advisories were duplicated by the feed). This was an executed pip-audit check,
  not a claim about reachability of every advisory.
- A **fresh Python 3.11 environment** at `/tmp/revamp-validated-backend` was built
  from the revised requirements. Its complete installed tree (76 packages,
  including installation tools) was audited with pip-audit 2.10.1.
- Final Python audit: **two feed entries for one unique advisory in one package**:
  `scikit-learn==1.4.2`, `PYSEC-2024-110`. This check exits 1 because the finding is
  explicitly retained; do not describe the Python audit as clean.
- Machine-readable summary: `docs/dependency-audit.json`.

Commands executed (the audit utility was isolated in its own `/tmp` directory):

```bash
PYTHONPATH=/tmp/revamp-audit-deps backend/venv/bin/python -m pip_audit \
  --no-deps --disable-pip -r backend/requirements.txt -f json \
  -o /tmp/revamp-python-audit.json

PYTHONPATH=/tmp/revamp-audit-deps backend/venv/bin/python -m pip_audit \
  --path /tmp/revamp-validated-backend/lib/python3.11/site-packages \
  -f json -o /tmp/revamp-python-audit-final.json
```

The first command audited the original manifest before its replacement. The
second audited the actual final installed dependency tree.

## Remediation

- Django 4.2.30 → **5.2.17**, DRF 3.16.1 → **3.18.2**, Gunicorn 21.2 → **23.0**,
  python-dotenv 1.2.1 → **1.2.2**.
- LangChain Core → **1.8.4**, Groq integration → **1.2.1**, LangGraph → **1.2.24**;
  resolved SDK/checkpoint/prebuilt versions are constrained in `constraints.txt`.
- Removed unused high-level LangChain, community/OpenAI integrations, standalone
  OpenAI/tiktoken, matplotlib and seaborn requirements. The actual app imports
  only Core messages/tools, Groq and LangGraph. This removes unused vulnerable
  integrations without replacing the product's implemented provider.
- Updated build-environment pip/setuptools. Docker upgrades them before installing
  runtime requirements. Docker exclusions prevent `.env`, local environments,
  databases and media from entering build contexts.
- Django static storage now uses the supported `STORAGES` configuration.
- Full runtime dependencies are constrained in `backend/constraints.txt` so a later
  install does not silently select a different SDK/prebuilt combination.

The first attempted AI dependency combination did not resolve; it was corrected.
An intermediate graph/prebuilt version mismatch failed an import check; updating
and constraining the compatible stack resolved it. The added graph execution test
also found threaded ORM access incompatible with request transactions; the final
bounded owner-bound dispatcher runs database tools on the request thread.

## Explicit serialization compatibility exception

[PYSEC-2024-110](https://osv.dev/vulnerability/PYSEC-2024-110) concerns sensitive
training information exposed through `TfidfVectorizer` behavior; its listed fix is
sklearn 1.5. The application does **not** construct or expose `TfidfVectorizer`:
features use numeric imputation/scaling and categorical one-hot encoding. Users
cannot upload arbitrary serialized models to this API.

The application previously persisted sklearn 1.4.2 estimators in user model
bundles. Loading sklearn artifacts across versions is not a supported migration
strategy. To preserve historical inference compatibility, this revamp deliberately
keeps sklearn 1.4.2 (and original NumPy/pandas versions), records this exception,
and constrains the available training/prediction operations instead of silently
upgrading historical estimator serialization. This is a scoped exception, not a
claim that the package has no known vulnerability.

A future sklearn upgrade should retain a versioned legacy inference environment
or explicitly retrain historical experiments after user review. Do not claim
old models were evaluated or migrated by this change.

## Validation after upgrades

The fresh environment passed 36 Django tests, including real LangGraph tool
dispatch with a mocked provider, classification/regression, model persistence,
legacy label handling and exported-predictor parity. Normal Django checks,
migration drift checks, isolated SQLite migrations, dependency consistency, and
static-file collection passed. A Gunicorn run with DEBUG=False passed 19 real
HTTP checks across upload, cleaning, versions, training, inference, insights,
exports, provider failure and dataset cleanup. The exported FastAPI health and
prediction endpoints also passed in the fresh runtime.

Build from a fresh environment/container. Installing into a previous environment
may leave removed, unused packages behind. The user's existing local virtual
environment was not upgraded or purged during this verification.
