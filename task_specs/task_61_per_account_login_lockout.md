# Task 61 — Backend: replace flat IP-based login rate limit with per-account failed-attempt lockout

## Objective
Today, `/api/auth/login` is capped at `3/15minutes` keyed by client IP (`backend/src/infrastructure/rate_limiter.py`, `get_remote_address`), and the cap counts **every** request — successful logins included. Owner reported: switching between 3 different accounts on one machine (or one household network) triggers a 15-minute lockout, even though every login was correct. Fix: only failed attempts should cost anything, and lockout should track the account being attempted, not just the IP making the requests.

## Context
- Confirmed today's behavior via direct code read: `backend/src/modules/auth/presentation/routes.py:51`, `@limiter.limit("3/15minutes")` on the `login` route, using the shared `limiter` from `backend/src/infrastructure/rate_limiter.py` (`key_func=get_remote_address`, disabled when `ENVIRONMENT == "test"`).
- `LoginUser.execute()` (`backend/src/modules/auth/application/use_cases/login_user.py:14-35`) raises `InvalidCredentialsError` on both "user not found" and "wrong password" — deliberately not distinguishing the two to avoid leaking which usernames exist. Keep that behavior; do not change what the client sees on failure.
- `User` domain entity (`backend/src/modules/auth/domain/entities/user.py:4-19`): constructor is `username, display_name, password_hash, id=None, created_at=None` — no lockout fields exist.
- `UserRepository` interface (`backend/src/modules/auth/domain/interfaces/user_repository.py:6-22`) has exactly 3 methods: `get_by_username`, `save`, `exists_by_username`. `save()` in `UserRepositoryImpl` (`backend/src/modules/auth/infrastructure/repositories/user_repository_impl.py:22-41`) only persists `username`, `display_name`, `password_hash` on update.
- SQLAlchemy model: `backend/src/modules/auth/infrastructure/models/user_model.py:8-20`, table `users` — `id, username, display_name, password_hash, created_at, updated_at`. No lockout columns.
- Domain exceptions: `backend/src/modules/auth/domain/exceptions.py` — `AuthException` (base), `InvalidCredentialsError`, `UsernameAlreadyTakenError`. No lockout-specific exception exists yet.
- Migrations live in `backend/migrations/versions/` (not `alembic/versions/`). The most recent migration is `exercises_is_custom_001` (`down_revision=add_exercise_metadata_001`). **Verify the actual current head yourself** (`alembic heads` from `backend/`) before writing a new migration's `down_revision` — do not assume the chain above is still accurate by the time you start; this exact mistake has happened multiple times before in this project. Recent migrations use short slug-style revision ids (e.g. `exercises_is_custom_001`) rather than auto-generated hashes — follow that convention (e.g. `add_login_lockout_001`), and keep the id under 32 characters.
- Settings: `backend/src/config/settings.py` — pydantic-settings `Settings(BaseSettings)`, `ENVIRONMENT: str = "development"` plus other typed fields. Add new lockout settings following this existing pattern.
- Existing login tests: `backend/tests/integration/test_auth_routes.py`, `TestLoginRoute` (success at ~152, wrong password → 401 at ~167, nonexistent user → 401 at ~178), plus a separate rate-limit section (~257) with `test_login_rate_limit_exists` (~286) that only asserts responses are 200/401/429 — no lockout-specific tests exist today.

## Requirements

### 1. Widen the IP-level limit (coarse anti-abuse net only)
- Change `@limiter.limit("3/15minutes")` on `/api/auth/login` to something looser, e.g. `"15/15minutes"` — this stays as a broad guard against a single IP hammering the endpoint (any account, any outcome), not the primary defense anymore.
- Leave `rate_limiter.py` itself untouched (key func, test-environment disabling) — only the limit string on the route changes.

### 2. Add per-account failed-attempt tracking
- Add two columns to the `users` table via a new migration: `failed_login_attempts` (integer, not null, default 0) and `locked_until` (nullable timestamp).
- Add a migration in `backend/migrations/versions/` following this project's existing style (see Context above for the gotchas). Confirm the real current head before setting `down_revision`.
- Extend the `User` domain entity, the `UserRepository` interface, `UserRepositoryImpl`, and the SQLAlchemy model to carry these two fields through (read on `get_by_username`, write on whatever method you use to persist attempt/lockout changes — either extend `save()` or add a narrower method like `record_login_attempt` if that's cleaner given the existing `save()` does full create-or-update; your call, but don't make `save()` do double duty in a confusing way — document your choice briefly if you add a new method).

### 3. Lockout logic in `LoginUser.execute()`
- Before checking the password: if `locked_until` is set and still in the future, raise a new domain exception (e.g. `AccountLockedError`) — do not attempt password verification at all in this case.
- On wrong password: increment `failed_login_attempts`. If it reaches the configured threshold (new setting, e.g. `LOGIN_LOCKOUT_MAX_ATTEMPTS: int = 5`), set `locked_until = now + LOGIN_LOCKOUT_DURATION_MINUTES` (new setting, e.g. default 15) and persist both.
- On successful login: reset `failed_login_attempts` to 0 and clear `locked_until`, persisted immediately (a legitimate login should never leave stale failure state hanging around).
- Keep the existing behavior of not distinguishing "wrong password" from "user not found" in the response — a nonexistent username should not increment any counter (there's nothing to lock), and should return the same generic `InvalidCredentialsError` as today.

### 4. Surface the lockout to the client sensibly
- Add the new `AccountLockedError` to `backend/src/modules/auth/domain/exceptions.py`.
- In `presentation/routes.py`, catch it and return an appropriate HTTP status (423 Locked, or 429 if you'd rather stay consistent with the existing rate-limit status code — your call, but be consistent and document the choice) with a message that tells the user they're locked out and roughly how long (does not need to be exact-second precision — "try again in a few minutes" or an exact `retry_after` field, whichever fits this project's existing error-response shape).

## Do NOT
- Do not change what a wrong-password or nonexistent-username response looks like on the *first* few attempts — same generic "Invalid username or password" as today, until lockout actually triggers.
- Do not add any lockout logic to `/register` or `/check-username` — those keep their current IP-based limits untouched.
- Do not add IP-based per-account combination logic (e.g. keying by IP+username) — the two mechanisms (coarse IP limit, per-account lockout) are intentionally separate and independent, not combined into one key.
- Do not touch the frontend in this task — this is backend-only. If the frontend needs to show a nicer "account locked" message instead of a generic error, that's a follow-up, not part of this task.

## Acceptance criteria
- [ ] Logging into 3 different valid accounts from the same machine in quick succession no longer trips any limit.
- [ ] 5 consecutive wrong-password attempts on the *same* account lock only that account for the configured duration; a 6th attempt (even with the correct password) is rejected while locked.
- [ ] A successful login resets that account's failed-attempt counter and clears any lock.
- [ ] Attempting a nonexistent username repeatedly does not create or affect lockout state for any real account.
- [ ] The IP-level limit still exists as a coarse guard (confirm it's `15/15minutes` or whatever value you chose, not removed entirely).
- [ ] New migration applies cleanly on top of the actual current head (verify via `alembic heads`, not assumption) and is reversible (`downgrade()` drops the two columns).
- [ ] New tests cover: lockout after N failed attempts, rejection while locked, reset on success, and that a nonexistent username doesn't create lockout state. Full backend test suite still passes.

## Review checklist
- [ ] Confirm the migration's `down_revision` matches the actual current head at the time it's applied, not an assumed value from this spec — re-check via `alembic heads` yourself before approving.
- [ ] Confirm `LoginUser.execute()` still returns the exact same generic error for "wrong password" and "user not found" cases below the lockout threshold — no new information disclosed about which usernames exist.
- [ ] Confirm the reset-on-success write actually happens (a break-test: temporarily comment out the reset, confirm a test goes red) — this is the kind of thing that's easy to implement but easy to silently skip under a happy-path test.
