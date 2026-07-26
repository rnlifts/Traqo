# Task 25 — Backend production configuration

## Objective
Make the backend deployable to a platform like Railway/Render: read the port from the environment instead of hardcoding it, fail loudly if production secrets are left at their insecure defaults, and make an explicit decision about exposing `/docs`.

## Context
- `backend/run.py` currently hardcodes `port=5000`:
  ```python
  uvicorn.run("src.app:app", host="0.0.0.0", port=5000, reload=False)
  ```
  Most PaaS platforms (Railway, Render, Heroku-style) inject the port to listen on via a `$PORT` environment variable at runtime — a hardcoded port means the app won't be reachable.
- `backend/src/config/settings.py` has insecure dev-default fallbacks:
  ```python
  SECRET_KEY: str = "dev-secret-key-change-me"
  JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-me"
  ```
  These are fine as local-dev fallbacks, but if the platform's env vars are ever misconfigured (typo'd var name, forgot to set it), the app would silently start with a publicly-known secret key, signing JWTs that anyone could forge. It should fail to start instead, in production specifically.
- `settings.py` already has `ENVIRONMENT: str = "development"` — use this to distinguish local dev (fallbacks OK) from production (fallbacks must error).
- FastAPI exposes interactive API docs at `/docs` (Swagger UI) and `/redoc` by default — currently not disabled anywhere in `app.py`. This is a product decision, not a pure bug: some teams like keeping it available (useful for the code-review pass planned next), others disable it in production to reduce attack surface / avoid revealing the full API shape publicly. Default to disabling it in production but make it a one-line env-controlled toggle so it can be turned back on temporarily if needed for the review pass.

## Requirements
1. `backend/run.py`: read the port from the `PORT` environment variable, falling back to `5000` for local dev:
   ```python
   import os
   import uvicorn

   if __name__ == "__main__":
       port = int(os.environ.get("PORT", 5000))
       uvicorn.run("src.app:app", host="0.0.0.0", port=port, reload=False)
   ```
2. `backend/src/config/settings.py`: add a validation step so that when `ENVIRONMENT == "production"`, `SECRET_KEY`/`JWT_SECRET_KEY` cannot be left at their dev-default string values — raise a clear startup error if they are. Simplest approach: a `model_validator` (pydantic v2, since this project uses `pydantic-settings`) or a plain check right after `settings = Settings()` is constructed:
   ```python
   settings = Settings()

   if settings.ENVIRONMENT == "production":
       if settings.SECRET_KEY == "dev-secret-key-change-me":
           raise RuntimeError("SECRET_KEY must be set to a real value in production")
       if settings.JWT_SECRET_KEY == "dev-jwt-secret-key-change-me":
           raise RuntimeError("JWT_SECRET_KEY must be set to a real value in production")
   ```
   (Exact mechanism is your call — a validator or a plain post-construction check both work; the requirement is that the app refuses to start in production with default secrets, not that it takes a specific code shape.)
3. `backend/src/app.py`: make `/docs` and `/redoc` conditional on environment. Change the `FastAPI(...)` construction to:
   ```python
   docs_enabled = settings.ENVIRONMENT != "production"
   app = FastAPI(
       title="Traqo API",
       version="1.0.0",
       docs_url="/docs" if docs_enabled else None,
       redoc_url="/redoc" if docs_enabled else None,
       openapi_url="/openapi.json" if docs_enabled else None,
   )
   ```
4. Create `backend/.env.example` (doesn't exist today — only `frontend/.env.example` does) documenting every variable `Settings` reads, with placeholder/example values (no real secrets):
   ```
   ENVIRONMENT=development
   SECRET_KEY=change-me-to-a-random-value
   JWT_SECRET_KEY=change-me-to-a-different-random-value
   DATABASE_URL=postgresql://user:password@localhost:5432/traqo_dev
   TEST_DATABASE_URL=postgresql://user:password@localhost:5432/traqo_test
   CORS_ORIGINS=http://localhost:5173
   PORT=5000
   ```

## Do NOT
- Do not change any actual secret values in `backend/.env` (that file is untracked and stays local/personal — this task only affects `settings.py`'s validation logic and adds a new `.env.example` template).
- Do not remove the dev-default fallback values entirely — they're fine for local development; the fix is to reject them specifically when `ENVIRONMENT=production`.
- Do not disable `/docs` unconditionally — it should still work locally and in any non-production environment (e.g. a "staging" env value, if one is ever used, should probably also show docs — only gate on the literal string `"production"`).

## Acceptance criteria
- [ ] Backend starts normally locally with `ENVIRONMENT=development` (or unset, since that's the default) and dev-default secrets — no behavior change from today.
- [ ] Setting `ENVIRONMENT=production` with dev-default secrets still in place causes the app to fail to start with a clear error message (not a silent success).
- [ ] Setting `ENVIRONMENT=production` with real secret values set causes the app to start normally, and `GET /docs` returns 404 (docs disabled).
- [ ] With `ENVIRONMENT` unset/development, `GET /docs` still returns the Swagger UI as it does today.
- [ ] Starting the app with `PORT=8080` set in the environment causes it to actually bind to port 8080 (verify via `curl http://localhost:8080/api/health`).
- [ ] `backend/.env.example` exists and lists all variables `Settings` reads.

## Review checklist
- [ ] Verified live: all four scenarios above (dev start, prod-start-with-defaults-fails, prod-start-with-real-secrets-works-and-hides-docs, custom PORT respected) actually run, not just read from code.
- [ ] Confirm `backend/.env` (the real one, untracked) is untouched by this task.
