# Documentation review — 2026-11-23

Scope: documentation and verified starter-asset cleanup on main, as explicitly requested. No application logic, dependency versions, database schemas, migrations or hosting configuration changed.

## Changes

Rewrote the root README with a live application entry point, fixture screenshot showcase, Mermaid architecture, feature/stack tables, workflow, directory structure, setup, environment requirements, persistence, deployment, limits and roadmap. Added a documentation index and screenshot gallery. Historical revamp records retain their original results and now explicitly identify their dated scope; subsequent merge/deployment status is attributed to the maintainer rather than presented as independently tested production behavior.

## Cleanup evidence

- Removed tracked `frontend/src/assets/react.svg` and `vite.svg`: repository-wide reference search found no imports or build/documentation consumers; frontend build and lint passed after removal.
- Preserved tracked `backend/db.sqlite3`: settings use that exact local path, and its contents may be user data. Ignoring an already tracked file does not remove it from Git; any untracking/history cleanup requires a separate reviewed action.
- Preserved migrations, manifests, lock/constraint files, fixtures, screenshots, smoke utilities and Docker configuration because they have active references or execution roles.
- Extended ignores for virtual environments, pytest/Vite caches, coverage, browser test output, local environment files, SQLite sidecars and generated media. Environment examples remain allowed.

## Validation in this run

- `git diff --check`: passed.
- Relative Markdown link/image path check across README and docs: passed, no missing local targets.
- `npm run build` in frontend: passed.
- `npm run lint` in frontend: passed.
- `/tmp/revamp-validated-backend/bin/python backend/manage.py check --settings=core.test_settings`: passed.
- Existing overview screenshot visually inspected; reused existing real QA JPEGs without generating mock assets.
- Mermaid reviewed as a flowchart with balanced subgraphs and source-backed service connections. GitHub-rendered Markdown/Mermaid was not browser-tested in this run.
- Historical test suites were not rerun; their dated results remain in TEST_RESULTS.md.

## Manual follow-up

A real prediction simulator screenshot is still needed for that gallery entry. Suggested GitHub About description/topics are in docs/README.md; metadata was not changed. Hosting dashboard auto-deploy settings and production PostgreSQL were not independently inspected.

The backend Dockerfile copies requirements.txt and installs it before copying constraints.txt, which that requirements file references. This is a confirmed packaging ordering issue; it is documented rather than changed because the requested scope forbids deployment-code modifications. A separately reviewed Docker fix is required before claiming that image build succeeds. Current Vercel/Render deployment status comes from the maintainer's report, not a Docker build test.
