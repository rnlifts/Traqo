# Traqo: Flask → FastAPI Migration Plan

## Why

The project was originally planned around FastAPI; Flask was used by mistake early on. We're switching now, at the end of Sprint 3 (Auth, Exercises, Workout Plans all built and verified on Flask), because this is the cheapest point in the project to do it — every additional sprint built on Flask increases the eventual cost. See `CLAUDE.md` for current tech stack.

## What does NOT change

Because the backend follows clean architecture (`domain → application → infrastructure → presentation`), **`domain/` and `application/` in every module are framework-agnostic already and require zero changes.** This includes:

- All entities (`User`, `Exercise`, `WorkoutPlan`, `WorkoutExercise`)
- All domain exceptions and interfaces
- All use cases and their business logic — including the ownership-check logic, the username generator, and the reorder-swap logic

Do not touch these files. If a change to `domain/` or `application/` seems necessary during this migration, stop — that's a sign something is being done wrong, since the entire point of this migration being tractable is that these layers don't know what web framework or ORM wrapper is running above them.

**The frontend does not change at all.** It talks to JSON over HTTP; it has no framework awareness. Keep the API running on the same host/port (`http://localhost:5000`) so `VITE_API_BASE_URL` doesn't need touching.

## What does change

Everything in `infrastructure/` and `presentation/`, across all three existing modules (`auth`, `exercises`, `workouts`), plus the app-level scaffolding (`app.py`, `extensions.py`, `config/`, `requirements.txt`, `migrations/env.py`).

### The one real "gotcha" — DB session pattern

The current repositories (`UserRepositoryImpl`, `ExerciseRepositoryImpl`, `WorkoutPlanRepositoryImpl`, `WorkoutExerciseRepositoryImpl`) all use Flask-SQLAlchemy's global `db.session`, and routes currently instantiate repositories **once at module load time** (e.g. `exercise_repository = ExerciseRepositoryImpl()` at the top of `routes.py`). This worked because Flask-SQLAlchemy's `db.session` is a thread-local proxy that "just works" as a shared global.

Plain SQLAlchemy (what FastAPI uses) does not have that magic. The correct FastAPI pattern is a **per-request session via dependency injection**:

```python
# infrastructure/database.py (new, shared across modules)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Repositories must accept a `Session` in their constructor (`def __init__(self, session: Session)`) instead of importing a global. Routes construct repositories **per-request**, inside the route function, using `db: Session = Depends(get_db)` as a parameter — not once at import time. **Do not just port the module-level singleton pattern over — it will cause session-sharing bugs across concurrent requests.** This is the one place this migration is a genuine redesign, not a mechanical port.

## Phase 1 — Dependencies and app scaffolding

1. `requirements.txt`: remove `flask`, `flask-sqlalchemy`, `flask-jwt-extended`, `flask-bcrypt`, `flask-cors`, `flask-migrate`. Add `fastapi`, `uvicorn[standard]`, `sqlalchemy` (already a transitive dep, pin directly now), `alembic`, `pydantic-settings`, `python-jose[cryptography]` (JWT), `passlib[bcrypt]` (password hashing), `python-multipart` (form parsing, harmless to include).
2. Replace `config/base.py`, `development.py`, `production.py`, `testing.py` with a single `config/settings.py` using `pydantic_settings.BaseSettings`, reading `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `TEST_DATABASE_URL`, `FLASK_ENV`→rename to `ENVIRONMENT` from `.env` (pydantic-settings reads `.env` natively, no manual `load_dotenv()` needed, though keep `.env` itself unchanged — just rename the `FLASK_ENV` key to something framework-neutral like `ENVIRONMENT` and update `.env`/`.env.example` accordingly). Don't over-engineer this into 4 files again — one `Settings` class with an `environment` field is enough for this project's actual needs.
3. `extensions.py` → replaced by:
   - `infrastructure/database.py` (project-root shared, not per-module): the `get_db()` dependency shown above.
   - `infrastructure/security/jwt_service.py` (project-root shared): `create_access_token(user_id: int) -> str` and `decode_access_token(token: str) -> int`, using `python-jose`. Keep encoding the subject as a string in the token (`sub` claim), consistent with current behavior — this isn't a Flask quirk, it's normal JWT practice, don't change it just because the library changed.
   - A FastAPI dependency `get_current_user_id(token: str = Depends(oauth2_scheme)) -> int` replacing the current `@jwt_required()` + `get_jwt_identity()` pattern — this is what routes will use to get the authenticated user.
4. `app.py`: replace `create_app()` (Flask factory) with a FastAPI app instance. Add `CORSMiddleware` scoped to `http://localhost:5173` (same origin restriction as before — don't loosen it). Register routers via `app.include_router(...)` instead of `register_blueprint`. Replace the global `@app.errorhandler(Exception)` with FastAPI exception handlers (`@app.exception_handler(...)`) — and this is a good opportunity to centralize the domain-exception-to-HTTP-status mapping that's currently duplicated per-route (`WorkoutPlanNotFoundError` → 404, `UnauthorizedWorkoutPlanAccessError` → 403, etc.) into one place using FastAPI's exception handler registration, rather than repeating try/except blocks in every route like the Flask version did. This directly addresses the kind of bugs Sprint 3 had (mismatched error handling per route) by removing the repetition that caused them.
5. `run.py`: replace with `uvicorn.run(...)` or just document running via `uvicorn src.app:app --reload --port 5000`.
6. `migrations/env.py`: currently pulls metadata via Flask app context (`Flask-Migrate`). Rewire to import the plain SQLAlchemy declarative `Base.metadata` directly — this is a small, mechanical change since Flask-Migrate is itself just a thin CLI wrapper around plain Alembic.

## Phase 2 — Module-by-module port (repeat for `auth`, `exercises`, `workouts`, in that order — same dependency order as they were originally built)

For each module:

1. `infrastructure/models/*.py` — SQLAlchemy models stay almost identical, just switch from Flask-SQLAlchemy's `db.Model` base class to a plain shared `Base` (from `infrastructure/database.py`, `declarative_base()`).
2. `infrastructure/repositories/*.py` — apply the session-injection pattern described above. Constructor takes a `Session`.
3. `infrastructure/security/bcrypt_password_hasher.py` (auth module only) — switch from `flask_bcrypt` to `passlib.context.CryptContext(schemes=["bcrypt"])`. The interface (`hash`, `verify`) stays identical — this is the payoff of having defined it as a domain interface in Sprint 1.
4. `presentation/schemas.py` — rewrite as Pydantic `BaseModel` classes instead of the current hand-rolled dataclasses with manual `from_json` validation. This is a genuine improvement, not just a port — Pydantic gives you the validation `RegisterRequest.from_json` was doing manually, for free, with better error messages.
5. `presentation/routes.py` — rewrite as a FastAPI `APIRouter`. Each route: takes `db: Session = Depends(get_db)` and, where JWT-protected, `user_id: int = Depends(get_current_user_id)`. Constructs repositories and use cases **inside** the route function using the injected session (not at module level — see the gotcha above). Raises `HTTPException(status_code=..., detail=...)` for validation errors, but let domain exceptions propagate up to the centralized exception handlers from Phase 1 step 4 rather than catching them per-route.

## Phase 3 — Re-verification (mandatory, this is not optional)

This migration touches every route and every piece of infrastructure across three already-working, already-verified modules. **Re-run the full behavioral test suite from Sprints 1–3 via real HTTP calls** (not unit tests) before calling this done:

- Register, login (correct + wrong password), protected-route access without a token
- Exercise create/list/delete, ownership 403 (second user can't delete first user's exercise), no-JWT 401
- Workout plan create/list/detail/update/delete, add/remove/reorder exercises (confirm reorder is a genuine swap, not a duplicate order_number), cross-module ownership check (second user can't add first user's exercise to their own plan), no-JWT 401
- `alembic current` (or whatever the FastAPI-side migration command is) shows all three migrations applied cleanly on a fresh check
- Confirm `domain/` still has zero framework imports across all three modules (this should be trivially true since domain/ wasn't touched, but confirm nothing got accidentally added)
- `git status` clean

Report back with the actual HTTP responses/status codes from this re-verification, not just a claim that it was done — same standard as every sprint so far.

## Out of scope for this migration

Don't use this as an opportunity to add Sprint 4+ features, change the database schema, or change API request/response shapes — the goal is an identical-behavior swap of the framework underneath, verified against the exact same contract. `docs/api.md` should not need any content changes as a result of this migration (URLs, methods, request/response JSON shapes all stay the same).
