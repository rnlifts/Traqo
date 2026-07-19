# Traqo Architecture

This document reflects the system as actually built through Sprint 5. Update it when the architecture changes — don't let it drift into aspiration, see `CLAUDE.md`'s note about keeping docs truthful.

## 1. System Overview

```
Frontend (React + TypeScript, Vite)
        |
        | REST / JSON over HTTP
        |
Backend (FastAPI, Python)
        |
        | SQLAlchemy (per-request sessions)
        |
Database (PostgreSQL)
```

Two separate applications (`frontend/`, `backend/`), no shared code between them. The backend was originally built on Flask and migrated to FastAPI mid-project (end of Sprint 3) — see `docs/migration-fastapi.md` for why and how; the clean-architecture layering made the migration touch only `infrastructure/` and `presentation/`, not `domain/` or `application/`.

## 2. Backend Architecture

### 2.1 Clean Architecture + Modular Monolith

The backend is one deployable service, internally organized as a **modular monolith**: each feature is a self-contained module under `backend/src/modules/`, and each module is internally layered using clean architecture.

```
backend/src/
  app.py                    # FastAPI app instance, CORS, centralized exception handlers, router registration
  config/settings.py        # pydantic-settings, reads .env
  infrastructure/
    database.py              # SQLAlchemy engine, SessionLocal, get_db() dependency (shared across modules)
    security/
      jwt_service.py          # JWT create/decode (python-jose)
      oauth2.py                # get_current_user_id() FastAPI dependency
  modules/
    auth/
    exercises/
    workouts/
    sessions/
```

Each module follows the same four layers:

- **`domain/`** — entities, value objects, domain exceptions, repository/service interfaces. Plain Python only — **zero imports of FastAPI, SQLAlchemy, python-jose, or bcrypt anywhere in this layer, in any module.** This is enforced by convention and checked via grep during every sprint's review, not by tooling.
- **`application/`** — use cases (one class per user-facing action, e.g. `RegisterUser`, `AddWorkoutSet`, `DeleteWorkoutPlan`). Orchestrates business rules by depending on `domain/` interfaces only, injected via constructor. This is where ownership checks and cross-module validation live.
- **`infrastructure/`** — SQLAlchemy models (on a shared declarative `Base`), repository implementations (constructed with an injected `Session`, never as a module-level singleton — see §2.3), and concrete implementations of `domain/` interfaces (e.g. `BcryptPasswordHasher`).
- **`presentation/`** — FastAPI `APIRouter`s, Pydantic request/response schemas. Routes parse the request, call a use case, and return a response — no business logic here. Domain exceptions propagate up to centralized handlers in `app.py` rather than being caught per-route.

### 2.2 Dependency direction

```
Presentation → Application → Domain
Infrastructure implements Domain interfaces (dependency inversion)
```

A module's `application/` layer may depend on **another module's `domain/interfaces/`** (never its `infrastructure/`) when a cross-module check is needed. This pattern is used three times so far:

- `workouts/application/AddExerciseToPlan` depends on `exercises/domain/interfaces/ExerciseRepository` — validates the exercise being linked is owned by the requesting user.
- `sessions/application/StartWorkout` depends on `workouts/domain/interfaces/WorkoutPlanRepository` — validates the plan being started from is owned by the requesting user.
- `sessions/application/AddWorkoutSet` depends on `exercises/domain/interfaces/ExerciseRepository` — validates the exercise being logged is owned by the requesting user.
- `workouts/application/DeleteWorkoutPlan` depends on `sessions/domain/interfaces/WorkoutSessionRepository` — checks for existing sessions before allowing deletion.

### 2.3 Database session pattern

FastAPI uses **per-request dependency injection** for database sessions — `infrastructure/database.py` exposes a `get_db()` generator dependency; routes take `db: Session = Depends(get_db)` and construct repositories fresh inside each route function. Repositories are never instantiated as module-level singletons — that pattern belonged to the old Flask-SQLAlchemy setup (a thread-local global `db.session`) and does not translate safely to plain SQLAlchemy.

### 2.4 Ownership-check discipline

Every use case that acts on a specific resource follows the same order, established in Sprint 2 and repeated deliberately in every sprint since:

1. Load the resource — raise a `NotFoundError` if it doesn't exist.
2. Check ownership — raise an `UnauthorizedAccessError` if the requesting user doesn't own it.
3. Check any state preconditions (e.g. "session not already finished") — raise a state-specific error.
4. Only then perform the action.

This ordering matters for information leakage (don't reveal a resource's existence to someone who doesn't own it) and was the source of real bugs in earlier sprints when violated (see `dev-log.md`, Sprint 3).

### 2.5 Error handling

All domain exceptions are mapped to HTTP status codes in **one place** — `app.py`'s `@app.exception_handler(...)` registrations — rather than per-route try/except blocks. Every error response follows `{"error": "..."}`. This centralization was introduced during the FastAPI migration specifically to eliminate a class of bug that occurred under Flask, where each route hand-rolled its own exception mapping and occasionally got it wrong or forgot it entirely.

### 2.6 Authentication

JWT-based, via `python-jose`. Token subject (`sub` claim) is the user's numeric ID, encoded as a string (required by JWT convention, not a framework quirk). `infrastructure/security/oauth2.py` exposes `get_current_user_id()` as a FastAPI dependency, used on every protected route.

## 3. Frontend Architecture

```
frontend/src/
  api/              # one file per backend module (authApi.ts, exercisesApi.ts, workoutPlansApi.ts, workoutSessionsApi.ts) + shared axios client
  features/         # feature-scoped components (auth/, exercises/, workoutPlans/, sessions/)
  pages/            # route-level components that compose feature components
  routes/           # ProtectedRoute wrapper
```

- `api/client.ts` — shared axios instance, base URL from `VITE_API_BASE_URL`. `AuthContext` attaches the JWT to `axios.defaults.headers.common["Authorization"]` after login.
- `AuthContext` — holds the current user + JWT, persists to `localStorage`, restores on mount. Exposes a `loading` flag during that restoration (added in Sprint 6) so `ProtectedRoute` doesn't incorrectly redirect before the token has been read back from storage — see the Sprint 4 `dev-log.md` entry for the bug this fixes.
- Internal navigation uses React Router's `<Link>`/`navigate()` exclusively — a raw `<a href>` forces a full page reload, which remounts the app and re-triggers the auth-restoration race above.

## 4. Database

PostgreSQL, managed via SQLAlchemy models + Alembic migrations (`backend/migrations/`).

```
users
  ← workout_plans (user_id FK)
  ← exercises (user_id FK)
  ← workout_sessions (user_id FK)

workout_plans
  ← workout_exercises (workout_plan_id FK) → exercises (exercise_id FK)
  ← workout_sessions (workout_plan_id FK, no ON DELETE — deletion is blocked at the
     application layer if any session references the plan, see §2.2 DeleteWorkoutPlan)

workout_sessions
  ← workout_sets (workout_session_id FK, ON DELETE CASCADE)

exercises
  ← workout_sets (exercise_id FK)
```

**Deliberate design decision:** a workout plan cannot be deleted while any session (finished or in-progress) references it — enforced in `DeleteWorkoutPlan`, not by cascading the deletion or silently orphaning history. Losing a user's logged workout history because they deleted the plan template it was based on would be a worse outcome than just blocking the deletion with a clear error. This was discovered as a real bug during Sprint 5 (see `dev-log.md`) and fixed deliberately, not by accident.

## 5. What's explicitly not built

Per `CLAUDE.md`'s MVP scope: no email/OAuth auth, no password recovery, no notifications, no social features, no trainer portal, no analytics, no AI features. The clean architecture is specifically intended to make these additive later (new use cases, new domain interfaces) rather than requiring rework of existing modules — see the reasoning captured in this project's early planning conversation, not reproduced here since it's a design philosophy note rather than a fact about the current system.
