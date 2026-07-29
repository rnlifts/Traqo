# CLAUDE.md — Traqo Project Context

Project-specific facts for Traqo, read once per session by the `traqo-development` skill. Edit only when stack, architecture, scope, or deployment actually change — not automatically. For *how* Claude should work (workflow, review process), see the `traqo-development` skill; this file is facts only.

---

## Project Overview

**Name:** Traqo — a fitness app for tracking workouts, exercises, sets, reps, weight, and workout history.
**Why it exists:** to build a professional-quality app and learn professional software engineering principles along the way.

---

## Tech Stack

- **Frontend:** React + Vite (feature-based architecture)
- **Backend:** Python FastAPI (migrated from Flask — see `docs/migration-fastapi.md`)
- **Database:** PostgreSQL, SQLAlchemy ORM, Alembic migrations
- **Auth:** JWT, bcrypt password hashing
- **Hosting:** Railway (see Deployment section below)
- Frontend and backend are separate applications, deployed as separate Railway services.

---

## Architecture

Backend: **Clean Architecture** + **Modular Monolith**, organized by feature.
Dependency direction: `Presentation → Application → Domain`. Infrastructure implements interfaces used by inner layers. **Domain must never depend on FastAPI, SQLAlchemy, PostgreSQL, JWT, HTTP, or any external library.**

- **Presentation** — routes, request validation, HTTP responses. No business logic.
- **Application** — use cases (Register User, Finish Workout, etc.). Coordinates workflow.
- **Domain** — entities, value objects, business rules, interfaces. No framework code.
- **Infrastructure** — DB models, repository impls, JWT, password hashing, rate limiting.

Every backend feature module (`auth`, `workouts`, `exercises`, `sessions`) follows this same `domain/ application/ infrastructure/ presentation/` structure.

Frontend: feature-based (`features/<name>/`), with shared `components/`, `api/`, `contexts/`, `utils/`.

---

## API Style

REST, JSON, proper status codes:
```
GET    /api/workouts
POST   /api/auth/login
POST   /api/auth/register
PUT    /api/workouts/{id}
DELETE /api/workouts/{id}
```

---

## Current MVP Scope

**In scope:**
- Auth — register/login by name + password, auto-generated unique username. No email/password recovery yet.
- Workout Plans — day-of-week scheduling, target sets/reps/weight per plan exercise.
- Exercise logging types (2026-07-26) — each plan-exercise carries field-presence flags (`has_reps`/`has_weight`/`has_duration`) instead of a fixed enum. Trainer configures fields per exercise in Plan Builder; a client following that plan sees only the configured fields. Quick-start sessions allow inline field config on a never-logged exercise's first set. Reps is free-text (`"10"` or `"10-12"`); Duration stored in seconds. Optional per-set overrides ("Vary by set") live in `workout_exercise_set_targets`. Backend validation is deliberately permissive (one of weight/reps/duration non-null) — the flags are UI-display only, never backend-enforced.
- Workout Sessions — previous-performance prefill, quick-start vs. real-plan sessions (real plans strictly follow the plan: no ad-hoc exercises/sets mid-workout; quick-start allows both).
- Exercises, Workout History (progress-over-time views: per-exercise history, volume trend, est. 1RM, PR detection).

**Explicitly out of scope** (don't build without the person expanding scope first): notifications, social features, trainer portal, AI features, nutrition tracking, a shared/global exercise library.

**Planned future rework (unscheduled):** current exercise CRUD (`frontend/src/features/exercises/`) expected to be replaced with a default built-in library + drag-and-drop + autocomplete — see memory `traqo-exercise-module-future-plan`.

---

## Deployment (Railway)

**Live (as of 2026-07-26):** frontend `https://traqo.up.railway.app`, backend `https://backend-production-a6d4.up.railway.app` (Railway-generated domains — if either is renamed in the dashboard, `CORS_ORIGINS` on the backend **must** be updated to match, or every request breaks with a CORS 400).

- One Railway project (`disciplined-determination`), three services: `frontend`, `backend`, `Postgres`, all in the `production` environment.
- Backend: root dir `backend`, start `python run.py` (reads `$PORT`, defaults 5000 locally). `backend/.python-version` is **pinned to 3.11** — SQLAlchemy 2.0.23 crashes on Python 3.13's stricter typing internals, which is what Railway defaults to otherwise.
- Frontend: root dir `frontend`, build `npm run build`, start `npx serve -s dist -l $PORT` (the `-s` flag is required for React Router's client-side routes to survive a page refresh).
- Backend env vars: `ENVIRONMENT=production` (disables `/docs`, enforces real `SECRET_KEY`/`JWT_SECRET_KEY` — refuses to boot with dev-default secrets), `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `CORS_ORIGINS=<frontend URL>`.
- Frontend env var: `VITE_API_BASE_URL=<backend URL>/api` — baked in at **build** time, must be set before a build runs.

**Migrations on Railway — known-broken automation, do it manually:**
Railway's `preDeployCommand` config is unreliable on this project (config updates didn't consistently take effect across many attempts; root-caused to Railpack likely auto-injecting its own `alembic upgrade head` for any repo with a detected `alembic.ini`, ignoring explicit overrides). Instead:
1. Install Railway CLI, `railway login --browserless` (user approves the link — needs a real logged-in browser, can't be done headlessly).
2. `railway link` to the project/environment/service, then from `backend/migrations`: `railway run python -m alembic upgrade head` — but this runs *locally* with Railway's env vars injected, and `DATABASE_URL` resolves to `postgres.railway.internal` (private network, unreachable from outside Railway). Use the Postgres service's **`DATABASE_PUBLIC_URL`** instead (`railway service Postgres && railway variables`), passed explicitly: `DATABASE_URL="<public-url>" python -m alembic upgrade head` from `backend/migrations`.
3. `migrations/env.py` adds the backend root to `sys.path` explicitly (fixed 2026-07-26) so `from src...` imports work regardless of cwd — don't remove this, it's what makes migrations portable across environments that invoke alembic differently.

**Alembic revision IDs must be ≤32 characters** — `alembic_version.version_num` is `VARCHAR(32)`; a longer id fails silently mid-migration (the DDL runs, then the version-bookkeeping UPDATE fails, and Postgres's transactional DDL rolls the whole thing back).

**Schema drift risk:** `workout_sets.workout_exercise_id` existed in local dev (added via an ad-hoc script, since deleted) for a long time before anyone noticed it was never captured as an Alembic migration — production only got it 2026-07-26, after a live 500 error surfaced it. Any local DB change must go through a proper migration file, never a manual `ALTER TABLE` or throwaway script, or it will silently work locally and break in production.

---

## Coding Standards

Keep functions small, classes focused. Prefer composition over inheritance. Use type hints where practical. Avoid duplicate code. No unnecessary comments — code should read clearly on its own.

---

## Working Process

Claude acts as PM for Traqo: plans, delegates task specs to an implementing agent, and **independently verifies every claim live** (real browser/API calls, real DB queries) rather than trusting the agent's own "verified" self-report — this has repeatedly caught real bugs the agent's own testing missed. Task specs go to `task_specs/` as structured files (Objective/Context/Requirements/Do NOT/Acceptance criteria); the agent implements, PM verifies against the actual running app before considering a task done.

Stop and surface to the person (don't proceed automatically) when: the requirement is ambiguous at a product level, the change touches auth/payments/user-data-destructively, or it's a genuinely irreversible action (bulk data deletion, force-push, etc.) — for those, hand over the exact command/SQL rather than running it directly if execution is blocked or inappropriate.

---

*Last updated: 2026-07-27.*
