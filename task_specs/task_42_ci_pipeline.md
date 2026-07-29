# Task 42 — Wire up a CI pipeline (GitHub Actions)

## Objective
There is currently no CI at all (`.github/workflows/` doesn't exist). Once Tasks 40 (frontend tests) and 41 (backend tests) exist, add a GitHub Actions workflow that runs everything automatically on every push/PR, so a bad change gets caught before merge instead of relying on manual verification.

Depends on Task 40 and Task 41 being complete (there's nothing to run in CI otherwise).

## Context
- No `.github/workflows/` directory exists in this repo yet — this is a from-scratch setup, not editing an existing pipeline.
- Backend: `backend/tests/` (pytest), needs a real Postgres instance for the cascade-delete tests added in Task 41 (SQLite-only won't cover those). GitHub Actions supports Postgres via a `services:` container in the workflow — use that rather than trying to install Postgres manually in the runner.
- Backend also needs its migrations actually run against that fresh CI Postgres instance before tests execute (`alembic upgrade head`) — this project has a documented history of migrations behaving unexpectedly (see the "known-broken automation" notes about Railway's `preDeployCommand` and the manual-migration workflow in `CLAUDE.md`) — so explicitly run migrations as their own CI step, don't assume they'll happen implicitly, and make the step's success/failure visible separately from the test run itself.
- Frontend: `npm test` (Vitest, from Task 40), `tsc --noEmit` (already used manually throughout this project's verification passes — this is the type-check step), and `oxlint` (already the configured lint script in `package.json`).
- Playwright E2E (Task 43) is a slower, heavier suite — run it on a different trigger/cadence than the fast unit/component tests (e.g. only on merges to `main`, or nightly), not on every single push, to keep PR feedback fast.

## Requirements

### 1. `.github/workflows/ci.yml` — fast checks, every push/PR
- **Backend job**: spin up a Postgres service container, run `alembic upgrade head` against it as an explicit step, then run `pytest` from `backend/`.
- **Frontend job**: install deps, run `tsc --noEmit`, run `oxlint`, run `npm test` (Vitest).
- Both jobs should run in parallel (they're independent), and the workflow should fail (block merge) if either fails.
- Use the same Python/Node versions this project already pins locally (`backend/.python-version` = 3.11; check `frontend/package.json`'s engines or just use a current LTS Node if unspecified).

### 2. A separate, slower workflow (or a separate job in the same file gated to `main`) for Playwright E2E
Once Task 43 exists, wire it to run on merges to `main` (not every PR push) — needs the full app running (backend + frontend + Postgres), which is heavier than the unit/component test jobs above.

### 3. Status visibility
Make sure workflow run results are easy to see from a PR (this is GitHub's default behavior once the workflow exists — just confirm the workflow triggers correctly on `pull_request` and `push` events for the relevant branches).

## Do NOT
- Do not skip the explicit `alembic upgrade head` step and assume the app boots migrations automatically — this project has been bitten by silent migration-automation failures before (see CLAUDE.md's Railway migration notes); CI should be explicit and visible about this step succeeding or failing on its own.
- Do not run the full Playwright E2E suite on every single push — too slow for PR feedback; gate it to `main` or a scheduled run.
- Do not hardcode secrets (DB passwords, etc.) directly in the workflow file — use GitHub Actions' service-container defaults or repository secrets as appropriate; nothing here should need real production credentials since it's all against fresh, disposable CI infrastructure.

## Acceptance criteria
- [ ] Opening a PR (or pushing to any branch) triggers the fast CI workflow automatically.
- [ ] The backend job spins up its own fresh Postgres, runs migrations, and runs pytest — verify by deliberately breaking a backend test and confirming the workflow reports failure.
- [ ] The frontend job runs type-check, lint, and tests — verify by deliberately introducing a TypeScript error and confirming the workflow catches it.
- [ ] A passing PR shows all green checks; a failing one blocks with a clear indication of which job failed.
- [ ] The Playwright E2E job (once Task 43 lands) is wired but does not run on every PR push — only on the slower cadence.

## Review checklist
- [ ] Migration step's success/failure is visible as its own distinct step in the workflow log, not bundled invisibly into the test step.
- [ ] No secrets or real credentials committed into the workflow file.
- [ ] Workflow doesn't silently skip a job (e.g. via a misconfigured trigger condition) — verify both jobs actually ran on a real test push, not just that the YAML parses.
