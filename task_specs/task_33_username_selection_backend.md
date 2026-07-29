# Task 33 — Backend: user-chosen usernames with a live availability check

## Objective
Replace auto-generated usernames (e.g. `aryan_8392`) with usernames the user picks themselves at registration. Add a lightweight, cheap-to-call endpoint the frontend can hit while the user is typing to tell them whether their chosen username is available, before they submit the form.

## Context — how registration works today
- `backend/src/modules/auth/domain/services/username_generator.py` (`UsernameGenerator.generate`) takes a `display_name`, sanitizes it (`lowercase, [a-z0-9_] only`), appends a random 4-digit suffix, and retries until it finds one that `user_repository.exists_by_username()` says isn't taken. This entire class becomes dead code after this task — **delete the file**, don't leave it unused.
- `backend/src/modules/auth/application/use_cases/register_user.py` (`RegisterUser.execute`) currently takes `(display_name, password)`, calls the generator internally, and saves the user.
- `backend/src/modules/auth/domain/entities/user.py` — the `User` entity already takes `username` as a constructor arg; nothing here needs to change, we're just supplying it differently.
- `backend/src/modules/auth/infrastructure/models/user_model.py:14` — `username = Column(String(80), unique=True, nullable=False, index=True)`. **This is already backed by a Postgres B-tree index via the `unique=True` constraint — no migration or index change is needed.** A B-tree gives O(log n) exact-match lookups and is what Postgres requires under the hood to enforce uniqueness anyway; there's no better standard structure to swap in for this access pattern. Do not add a new index or change the column type.
- `backend/src/modules/auth/infrastructure/repositories/user_repository_impl.py:43` already has `exists_by_username(username: str) -> bool` — reuse this directly for the new endpoint, don't write a second query path.
- `backend/src/modules/auth/presentation/routes.py` and `schemas.py` — existing `/api/auth/register` and `/api/auth/login` routes, shown in full below since you'll be editing right next to them:
  ```python
  @auth_router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
  @limiter.limit("10/minute")
  async def register(request: Request, req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
      user_repository = UserRepositoryImpl(db)
      use_case = RegisterUser(user_repository, password_hasher)
      user = use_case.execute(req.display_name, req.password)
      return RegisterResponse(message="Account created successfully", username=user.username)
  ```
- Rate limiting infra already exists and is already used on `/register` (`10/minute`) and `/login` (`3/15minutes`) — `backend/src/infrastructure/rate_limiter.py` exports `limiter` (a `slowapi.Limiter`). Reuse this same `limiter` for the new endpoint via the same `@limiter.limit(...)` decorator pattern.
- Exception → HTTP mapping convention: look at `app.py`'s existing `@app.exception_handler(InvalidCredentialsError)` (around line 242) for the pattern to copy for the new "username taken" error.

## Why the availability endpoint needs to double-check at registration time too
The frontend will call the new check endpoint while the user types, get back "available," and the user might not click Register for several more seconds (or another browser tab could register the same name in the meantime). This is a classic check-then-act race condition (TOCTOU). **The availability endpoint is a UX convenience only — it is never the sole source of truth.** `RegisterUser` must independently re-check uniqueness (or rely on the database's own `UNIQUE` constraint erroring out) at the moment of actual registration, and return a clear, specific error if the race was lost — not a generic 500.

## Requirements

### 1. Username format rules (used in both the check endpoint and registration)
Define these once, in one place both call sites can share (e.g. a small validator function in `backend/src/modules/auth/domain/services/username_validator.py`, replacing the deleted generator file):
- Length: 3–20 characters.
- Allowed characters: lowercase letters, digits, underscore only (`^[a-z0-9_]+$`) — same character set the old generator already sanitized down to, just enforced instead of silently stripped.
- Must start with a letter (not a digit or underscore) — prevents purely-numeric or leading-underscore usernames.
- Normalize input to lowercase before validating/checking/storing (so `"Aryan"` and `"aryan"` are treated as the same username) — do this server-side regardless of what the frontend sends, don't trust the client to have already lowercased it.

### 2. New endpoint: `GET /api/auth/check-username`
- Query param: `username` (string).
- No authentication required (this runs during registration, before the user has an account).
- Steps: normalize (lowercase, trim) → validate format (rules above) → if invalid, return `{"available": false, "reason": "<specific format error, e.g. 'Must be 3-20 characters' or 'Only lowercase letters, numbers, and underscores allowed'>"}` **without touching the database at all** (this is the cheap client-input-already-invalid short-circuit — don't waste a DB round-trip on obviously-bad input) → if valid, call `user_repository.exists_by_username(normalized)` and return `{"available": true}` or `{"available": false, "reason": "Username is already taken"}`.
- Rate-limit it, matching the existing convention: something generous enough not to interfere with normal debounced typing (a real user debounced at ~400ms won't exceed a few requests per second even typing fast) but capped enough to block scripted enumeration — `20/minute` per IP is a reasonable starting point, adjust if it proves too tight in testing.
- Response schema: add `CheckUsernameResponse { available: bool, reason: str | None }` to `presentation/schemas.py`.

### 3. Update `RegisterRequest` schema
Add a required `username` field (apply the same format validation via Pydantic `Field(..., pattern=r"^[a-z][a-z0-9_]{2,19}$")` or equivalent, so malformed input is rejected before it even reaches the use case). Keep `display_name` exactly as it is today (still free-text, still not unique, still `min_length=1`) — per the product decision, this field is being relabeled "Nickname" in the UI only; nothing about its backend shape, validation, or storage changes.

### 4. Update `RegisterUser.execute()`
Change the signature to `execute(self, display_name: str, username: str, password: str) -> User`. Remove the `UsernameGenerator` import and call entirely. Before saving:
- Normalize the incoming username (lowercase) the same way the check endpoint does.
- Call `self.user_repository.exists_by_username(username)` — if `True`, raise a new `UsernameAlreadyTakenError` (add to `domain/exceptions.py`, subclassing the existing `AuthException` base). Do not let this fall through to a raw database `IntegrityError` from the `UNIQUE` constraint — catch the case explicitly and raise a clean domain error, same as the rest of this codebase's error-handling convention (see how other modules raise specific domain exceptions rather than letting DB errors bubble up raw).
- Then proceed exactly as before (hash password, construct `User`, save).

### 5. Update the `/register` route handler
Pass `req.username` through to `use_case.execute(req.display_name, req.username, req.password)`.

### 6. New exception handler in `app.py`
Add `@app.exception_handler(UsernameAlreadyTakenError)` returning a `409` with a clear message (e.g. `"That username is already taken."`), following the exact pattern already used for `InvalidCredentialsError` nearby.

### 7. Delete `username_generator.py`
No longer has any callers after this task — remove it rather than leaving dead code.

## Do NOT
- Do not add a new database index or change the `username` column's type — the existing unique B-tree index is already the right tool for this and needs no modification.
- Do not skip the server-side uniqueness re-check at registration time just because the check-username endpoint exists — the race condition described above is real and must be handled.
- Do not change anything about `display_name`'s backend validation, storage, or the `login` endpoint — this task only touches registration and adds one new read-only endpoint.
- Do not require authentication on `GET /api/auth/check-username` — it must be callable by an unauthenticated visitor mid-registration.

## Acceptance criteria
- [ ] `GET /api/auth/check-username?username=ab` (too short) → `{"available": false, "reason": "..."}`, and confirm via logs/DB query that no database query was executed for this case (format check short-circuits first).
- [ ] `GET /api/auth/check-username?username=<existing real username>` → `{"available": false, "reason": "Username is already taken"}`.
- [ ] `GET /api/auth/check-username?username=<some never-used lowercase alphanumeric string>` → `{"available": true}`.
- [ ] `GET /api/auth/check-username?username=SomeMixedCase123` → correctly normalized to lowercase before the existence check (verify it matches/conflicts correctly against an existing lowercase username of the same letters).
- [ ] `POST /api/auth/register` with a `username` that's already taken → clean `409` with a specific message, not a raw 500 or unhandled `IntegrityError`.
- [ ] `POST /api/auth/register` with a malformed username (too short, invalid characters, starts with a digit) → `422`/clear validation error from the Pydantic schema, before ever reaching the use case.
- [ ] Successfully registering with a valid, available username still works end-to-end exactly as before (login with that username afterward succeeds).
- [ ] `username_generator.py` no longer exists in the codebase, and nothing imports it.
- [ ] Rate limiting is active on the new endpoint (verify a burst of requests eventually gets a `429`).

## Review checklist
- [ ] Username normalization (lowercasing) happens in exactly one shared place used by both the check endpoint and `RegisterUser`, not duplicated/reimplemented twice with potential for drift.
- [ ] No new Alembic migration was added for this task (there should be no schema change needed at all).
- [ ] Exception handling matches the existing codebase convention (domain exception → specific `@app.exception_handler`), not a generic try/except in the route.
