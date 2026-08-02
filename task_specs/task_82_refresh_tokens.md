# Task 82 — Add refresh tokens (currently the app has none)

## Objective
Today, login issues a single JWT access token that's valid for a **flat 24 hours** (`backend/src/infrastructure/security/jwt_service.py:19`, hardcoded `timedelta(days=1)`), with no server-side record of it at all — fully stateless. There's no way to shorten its lifetime without logging everyone out constantly, no way to revoke a specific session (e.g. "log out this device" or respond to a leaked token), and no way to know how many active sessions a user has.

This task adds a standard access-token + refresh-token pair:
- **Access token**: shortened to **30 minutes**, same JWT mechanism as today (`create_access_token`), used for all API auth exactly as now.
- **Refresh token**: a long-lived (**30 days**), opaque, random, server-tracked token. When the access token expires, the frontend silently exchanges the refresh token for a new access token (and a new rotated refresh token) without the user noticing or having to log in again. This is what makes the shorter access-token lifetime viable without hurting UX.

This is a security-sensitive change (touches auth end-to-end). Read the whole spec before starting, and match the precision/rigor already established in this codebase's auth code (see `backend/src/modules/auth/` for the existing lockout feature's style).

## Backend changes

### New table: `refresh_tokens`
New migration in `backend/migrations/versions/`. **Before writing it, run `alembic heads` (via `venv/Scripts/python.exe -m alembic -c migrations/alembic.ini heads` from `backend/`) to find the actual current head and set `down_revision` to that — do not guess or copy a value from an old migration, this codebase has a documented history of migration drift.**

Columns:
- `id` (PK)
- `user_id` (FK → `users.id`, `ondelete='CASCADE'` — if a user is deleted, their refresh tokens are meaningless)
- `token_hash` (string, unique, indexed) — **store a SHA-256 hash of the token, never the plaintext token.** This mirrors how passwords are never stored plaintext; a DB leak should not hand out usable refresh tokens.
- `created_at` (timestamp)
- `expires_at` (timestamp) — `created_at + 30 days`
- `revoked_at` (timestamp, nullable) — set when the token is rotated out or explicitly logged out; a non-null value means this token can never be used again, even if `expires_at` hasn't passed.

### Token generation & hashing
New file `backend/src/infrastructure/security/refresh_token_service.py` (mirrors the existing `jwt_service.py` naming/location):
- `generate_refresh_token() -> str` — a cryptographically random opaque string (`secrets.token_urlsafe(48)` or similar — not a JWT, no reason to encode claims in the token itself since it's looked up server-side anyway).
- `hash_refresh_token(token: str) -> str` — SHA-256 hex digest, used both when storing and when looking up a presented token (`hashlib.sha256(token.encode()).hexdigest()`).

### `POST /api/auth/login` (`backend/src/modules/auth/presentation/routes.py:50-73`)
After the existing `create_access_token(user.id)` call, also generate a refresh token, hash it, persist a `refresh_tokens` row (30-day expiry), and return the **plaintext** refresh token (only time it's ever plaintext) alongside the access token. Update `LoginResponse` (`schemas.py:42-51`) to add `refresh_token: str`.

### New endpoint: `POST /api/auth/refresh`
- Request body: `{ refresh_token: str }`.
- Look up the token by its hash. If not found, already revoked, or past `expires_at` → `401`.
- **Rotate on use**: mark the presented token's row `revoked_at = now()`, generate a brand-new refresh token + row (another 30 days out), and issue a fresh 30-minute access token. Return both new tokens in the same shape as login's response (minus the `user` object, or include it — match whatever's simplest given `LoginResponse`'s existing shape; reuse that schema if convenient).
- Rotation matters: if a refresh token is ever stolen and used by an attacker, the legitimate user's next refresh attempt will fail (their token was already rotated out by the attacker's use), which is a detectable signal — better than a static refresh token that works forever once leaked.
- Rate-limit this endpoint, matching the existing pattern on other auth routes (`routes.py:50` uses `15/15minutes` for login — use the same or similar; use your judgment but don't leave it unlimited).

### New endpoint: `POST /api/auth/logout`
Today logout is entirely client-side (just clears localStorage) — there's nothing to revoke server-side because no refresh token exists yet. Now that one does:
- Request body: `{ refresh_token: str }`.
- Look up by hash, set `revoked_at = now()` if found (no error if not found/already revoked — logout should never fail from the user's perspective).
- No rate limit needed (this isn't a credential-guessing target).

### Access token expiry change
Change the default in `create_access_token` (`jwt_service.py:19`) from `timedelta(days=1)` to `timedelta(minutes=30)`. Confirm nothing else in the codebase passes an explicit `expires_delta` that would be affected differently (per the Explore research, nothing currently does — callers always use the default).

## Frontend changes

### `frontend/src/features/auth/AuthContext.tsx`
- `login(token, user)` → `login(token, refreshToken, user)`: also store `localStorage.setItem('refresh_token', refreshToken)`.
- `logout()`: before clearing local state, fire `POST /api/auth/logout` with the stored refresh token (best-effort — don't block logout on it succeeding; wrap in try/catch and clear local state regardless). Then clear `auth_token`, `refresh_token`, `current_user` from localStorage as it does today.
- On mount (the existing rehydrate-from-localStorage `useEffect`), also rehydrate `refresh_token` if present.

### `frontend/src/api/client.ts` — extend the existing 401 interceptor
The interceptor added for Task 81 (lines 12-26) currently does: on 401 → clear session → redirect to `/login`. That behavior should now be the **fallback**, not the first move. New flow:

1. On a 401, first check if a `refresh_token` exists in localStorage. If not, fall through to today's clear-and-redirect behavior unchanged.
2. If a refresh token exists, attempt `POST /api/auth/refresh` with it — **use a plain `axios.post(...)` call (or a separate axios instance), not `client` itself**, to avoid the refresh call's own failure recursively triggering this same interceptor.
3. If the refresh succeeds: store the new access token and new refresh token (same localStorage keys, overwriting the old ones), update `client.defaults.headers.common['Authorization']`, then **retry the original failed request** with the new token and resolve the original promise with that retried response — the calling code that triggered the 401 should never see an error at all in this case.
4. If the refresh call itself fails (expired/revoked/invalid refresh token): fall through to today's clear-and-redirect behavior.
5. **Concurrency**: if multiple requests get 401'd around the same time (e.g. several optimistic Task 81 mutations in flight together), do not fire multiple simultaneous `/api/auth/refresh` calls — the first 401 should start the refresh and store the in-flight promise (module-level variable), and any 401 that arrives while a refresh is already in progress should await that same promise rather than starting a new one. Clear the in-flight promise variable once it resolves/rejects.

### Register flow
Out of scope — `POST /api/auth/register` doesn't return any token today (user logs in separately after registering) and that's unchanged by this task.

## Do NOT
- Do not store the refresh token in plaintext anywhere in the database — only the hash.
- Do not make the access token's expiry configurable/longer than 30 minutes as part of this task — the whole point is a short-lived access token backed by the refresh mechanism; if 30 minutes proves wrong in practice that's a follow-up tuning task, not something to preemptively relax here.
- Do not touch `handleCustomizeWeek` or anything in `PlanBuilder.tsx` — unrelated to this task.
- Do not change the login lockout logic (`login_user.py`, `user_repository_impl.py`) — refresh tokens are orthogonal to failed-password lockout; just be aware it exists so you don't accidentally collide with it (e.g. don't reset lockout state anywhere in the new refresh/logout endpoints).
- Do not implement "log out all other devices" / a token-listing UI — this task is just the core mechanism (issue, rotate, revoke-on-logout). A device-management UI is a reasonable future task but not this one.

## Required tests
Per current testing policy:

**Backend:**
- Refresh token generation produces unique tokens; hashing is deterministic and the stored hash never matches the plaintext.
- `POST /api/auth/refresh` with a valid token succeeds and returns new access + refresh tokens.
- `POST /api/auth/refresh` with an already-rotated (previously-used) token fails with 401 — this is the core rotation-security regression test.
- `POST /api/auth/refresh` with an expired token fails with 401.
- `POST /api/auth/refresh` with a revoked (logged-out) token fails with 401.
- `POST /api/auth/logout` revokes the token such that a subsequent refresh attempt with it fails.
- `POST /api/auth/login` response includes a `refresh_token` field and it round-trips successfully through `/api/auth/refresh`.

**Frontend:**
- A request that gets a 401, successfully refreshes, and the original request is transparently retried and resolves — the caller sees a normal success, not an error.
- A request that gets a 401 where the refresh call itself also fails — falls through to the existing clear-localStorage-and-redirect behavior (regression test for Task 81's existing interceptor behavior, now nested one level deeper).
- Two simultaneous 401'd requests trigger only **one** `/api/auth/refresh` call, not two (the concurrency/dedup regression test).
- `AuthContext`'s `logout()` calls the backend logout endpoint with the stored refresh token before clearing local state.

## Acceptance criteria
- [ ] Access tokens expire in 30 minutes; refresh tokens in 30 days.
- [ ] A user who stays active past 30 minutes never sees a forced logout — the refresh happens transparently.
- [ ] A refresh token can only be used once (rotation enforced) — reusing an already-used one fails.
- [ ] Logging out revokes the refresh token server-side, not just client-side.
- [ ] `refresh_tokens.token_hash` is the only representation of the token stored in the DB — confirm via the migration and repository code that plaintext is never written.
- [ ] Full backend and frontend test suites pass, including all new tests above; `npx tsc -b` clean.

## Review checklist
- [ ] This touches authentication — apply the same scrutiny as the existing login-lockout feature. Specifically verify: tokens are hashed before storage (grep the diff for anywhere a raw token might get logged or persisted in plaintext by accident), rotation actually invalidates the old token (test it, don't just read the code), and the rate limit on `/api/auth/refresh` is actually wired up (test that it 429s past the limit, matching how login's rate limit is presumably already tested).
- [ ] Confirm the frontend interceptor change doesn't create an infinite loop (a failed refresh attempt must not itself be able to trigger another refresh attempt via the same interceptor).
- [ ] Confirm the migration's `down_revision` is correct against the actual current head, not assumed.
- [ ] Live-verify: log in, manually expire/tamper with the stored access token (or wait/mock a 30-min-old token), make a request, and confirm it transparently refreshes rather than bouncing to login.
