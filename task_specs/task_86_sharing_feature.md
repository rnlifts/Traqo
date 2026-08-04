# Task 86 — Plan sharing feature (phases 2–5: endpoints, access resolution, logging attribution, UI)

## READ THIS FIRST — strict execution rules (non-negotiable)

Past tasks in this repo have repeatedly shipped placeholder tests (`expect(true).toBe(true)`
with "verified by code review" comments) and false verification claims ("tsc clean" when it
wasn't, endpoints that crashed on first real call). Every one of those was caught in review
and the task was sent back. So, for this task:

1. **A test that does not execute the code it claims to test is a task failure.** No
   `expect(true).toBe(true)`, no "documented/code-review-verified" tests, no asserting
   only that a mock "is defined". Every test must call a real endpoint (TestClient) or
   render the real component and assert on actual behavior. If you believe a required test
   is genuinely impractical, STOP and say so in your report — do not fake it.
2. **Run, do not claim.** Before reporting done: run the FULL backend suite
   (`venv/Scripts/python.exe -m pytest -q` from `backend/`), the FULL frontend suite
   (`npx vitest run` from `frontend/`), and `npx tsc -b` (from `frontend/`, it is a
   separate check from vitest). Paste the actual final counts in your report. If anything
   fails, fix it or report the failure honestly — do not report numbers you did not see.
3. **Work phase by phase, in order (2 → 3 → 4 → 5). STOP after each phase** and report
   what was built + verification output before starting the next. Do not jump ahead.
4. **Do NOT create any new database migration.** The schema for this entire feature
   already exists (migration `plan_shares_001`, applied to dev). If you think you need a
   schema change, STOP and ask — do not write a migration.
5. **Do NOT `git push`, do not deploy, do not touch the production database.** The prod
   migration is deliberately pending and will be coordinated by the reviewer. Local
   commits are fine.
6. **Do not modify** existing step-1 files except where this spec explicitly says to
   extend them: `plan_shares_001.py`, `plan_share.py` (entity), `plan_share_repository.py`
   (interface), `plan_share_repository_impl.py`, `share_token_service.py` are DONE and
   verified — build on top of them, don't rework them. Do not rename or move anything.
7. **Scope discipline.** Anything not listed in this spec is out of scope. In particular:
   no "log on someone else's behalf" UI (see Phase 4 note), no share-analytics, no email
   invites, no RBAC/role tables, no refresh-token work, nothing in `PlanBuilder.tsx`
   beyond what Phase 5 lists.

## Context — what already exists (step 1, commit 03883e0)

Design source of truth: the project memory file `traqo_sharing_feature_design.md` (public
link + username shares, permission tiers **view < log < edit**, ACL not RBAC,
trainer/client attribution rules). The data layer is fully built and tested:

- Tables (dev DB already migrated): `plan_shares` (one per plan; unique `token`; `mode`
  `'restricted'|'anyone'`; `link_permission` `'view'|'log'|'edit'`; soft revocation via
  `revoked_at`) and `plan_share_grants` (ACL; unique per share+user; `permission`).
  `workout_sessions` has nullable `share_id` and `logged_by_user_id`.
- `backend/src/modules/sharing/` module: `PlanShare`/`PlanShareGrant` entities,
  `permission_at_least(actual, required)` helper, `PlanShareRepository` interface,
  `PlanShareRepositoryImpl` (create, get_by_plan, get_by_token, update, add_grant
  [upserts], list_grants, get_grant_for_user, remove_grant).
- `src/infrastructure/security/share_token_service.py` → `generate_share_token()`.
- 9 passing integration tests in `tests/integration/test_plan_shares_repository.py` —
  use them as the style reference for new backend tests.

Design decisions already locked (do not relitigate):
- `mode='anyone'` MAY grant `edit` with **no login at all** — deliberate owner decision.
- Revocation is soft (`revoked_at` set, row kept) so `workout_sessions.share_id` written
  at log time is never rewritten or dangled. Never hard-delete a share except via plan
  deletion (CASCADE).
- Usernames are granted **one at a time**, each validated live against the users table.
  The ACL may accumulate multiple users overall.

---

## Phase 2 — Share management endpoints (owner-only)

New file `backend/src/modules/sharing/presentation/routes.py` (+ `schemas.py`, plus
`application/use_cases/` following the codebase's existing use-case pattern), router
prefix `/api/workout-plans/{plan_id}/share`, registered in `src/app.py` exactly like the
other routers. Every endpoint in this phase requires auth (`get_current_user_id`) and
must verify `plan.user_id == user_id`, returning **403** otherwise (404 if the plan
doesn't exist). Follow the DI style used everywhere else (instantiate repo impls in the
handler, pass into the use case).

- `POST /api/workout-plans/{plan_id}/share` — create the plan's share if none exists
  (token from `generate_share_token()`, defaults `mode='restricted'`,
  `link_permission='view'`); if one exists (even revoked), **un-revoke and return it**
  (set `revoked_at=None`) rather than erroring or making a second row (the table has a
  unique constraint on plan_id — there is only ever one share per plan). Response:
  `{ id, token, mode, link_permission, created_at, revoked_at }`.
- `GET /api/workout-plans/{plan_id}/share` — the share config + grants list (each grant:
  username, display_name, permission). 404 with a clear error body if the plan has no
  share yet.
- `PUT /api/workout-plans/{plan_id}/share` — update `mode` and/or `link_permission`.
  Validate values against the allowed literals (422 on anything else).
- `POST /api/workout-plans/{plan_id}/share/revoke` — soft revoke (`revoked_at = now`).
  Idempotent: revoking an already-revoked share is 200, not an error.
- `POST /api/workout-plans/{plan_id}/share/grants` — body `{ username, permission }`.
  Look the username up (case-insensitive, matching how login treats usernames); **404
  with error "User not found"** if absent; **400** if the username is the owner's own
  (sharing with yourself is meaningless). Upserts permission if the user already has a
  grant (repo already does this). Response includes the resolved username/display_name.
- `DELETE /api/workout-plans/{plan_id}/share/grants/{username}` — remove that user's
  grant; 204; no error if the grant doesn't exist.

**Required tests (backend, TestClient, real DB fixture like the step-1 test file):**
owner can create → get → update → revoke → re-create(un-revoke) round trip; non-owner
gets 403 on every management endpoint; unauthenticated gets 401; granting a nonexistent
username → 404; granting the owner themselves → 400; grant then re-grant same user with
new tier → one grant with the new tier; delete grant → gone; token in the create response
actually resolves via `get_by_token` in the repo.

## Phase 3 — Access resolution (the shared-plan read path)

New public endpoint, in the sharing module:

- `GET /api/shared/{token}` — **auth OPTIONAL.** Add an `get_optional_user_id` dependency
  variant in `src/infrastructure/security/oauth2.py` (uses `HTTPBearer(auto_error=False)`;
  returns `int | None`; invalid token → None, do NOT 401). Resolution logic (put it in a
  use case, e.g. `ResolveShareAccess`, so Phase 4 can reuse it):
  1. Look up share by token. Missing OR revoked → **404** (same response for both — do
     not leak that a revoked share exists).
  2. Determine the caller's effective permission:
     - Plan owner → `edit` (owners always have full access through their own link).
     - `mode='anyone'` → `link_permission`, for any caller including anonymous.
     - `mode='restricted'` → caller must be authenticated AND have a grant; effective
       permission = grant's permission. Anonymous or ungranted caller → **403** (NOT
       401 — see the interceptor warning below).
     - If a user both has a grant and mode is `anyone`, effective = the **stronger** of
       the two tiers (use `permission_at_least`).
  3. Response: the full plan detail (reuse `build_plan_detail_response` — the shared
     assembly helper already extracted in `workouts/presentation/routes.py`; import it,
     do not copy the logic) plus `{ permission: "<effective>", plan_owner_username,
     share: { mode } }`.

**⚠ Frontend 401 interceptor warning (this matters):** `frontend/src/api/client.ts` has a
response interceptor that clears the session and hard-redirects to `/login` on ANY 401.
Anonymous visitors on a shared page must never be bounced to login. Therefore the backend
must return **403/404 (never 401)** for share-permission failures on `/api/shared/*`, and
the anonymous request path must simply omit the Authorization header (no JWT = no 401
from `get_optional_user_id`, since it never auto-errors). Write a backend test asserting
an anonymous request to a restricted share returns 403, not 401.

**Required tests (backend):** anonymous + `anyone` mode → 200 with `link_permission`;
anonymous + `restricted` → 403; granted user + `restricted` → 200 with their tier;
ungranted authenticated user + `restricted` → 403; revoked token → 404; garbage token →
404; owner via own token → `edit`; grant tier vs link tier → stronger wins.

## Phase 4 — Logging through a share (attribution)

Extend the start-workout path so a session can be started *via a share* by a caller with
`log` (or `edit`) permission:

- `POST /api/shared/{token}/start` — body `{ plan_day_id, week_number? }` (mirror the
  existing `StartWorkoutRequest` fields minus plan id, which comes from the share). Auth
  optional, same dependency as Phase 3. Resolve access via the Phase-3 use case; require
  effective permission ≥ `log` (403 otherwise).
  Attribution rules — implement EXACTLY these, they encode the design's core decisions:
  - **Authenticated caller (grant or anyone-mode):** `session.user_id = caller`,
    `share_id = share.id`, `logged_by_user_id = caller`. The session belongs to the
    RECIPIENT — it appears in their history/stats, never the owner's.
  - **Anonymous caller (`anyone` mode only):** there is no account to attach to, so
    `session.user_id = plan_owner`, `share_id = share.id`, `logged_by_user_id = NULL`.
  - Never modify these three fields after creation, anywhere.
- Reuse the existing `StartWorkout` use case by extending it with optional
  `share_id`/`logged_by_user_id`/an override for the acting user — whatever is cleanest —
  but its ownership check must be adjusted: today it verifies the plan belongs to the
  caller; when starting via share, the share resolution IS the authorization, so the
  ownership check is skipped for that path only. Do not weaken the ownership check for
  the normal (non-share) path.
- The unfinished-session guard ("You have an unfinished workout") applies per
  `session.user_id` as today. For anonymous share sessions this means they collide with
  the owner's own unfinished sessions — acceptable for now; do not build anything special.
- Set logging / finishing / discarding an in-progress shared session: the existing
  session endpoints authorize by `session.user_id == caller`. Recipient-owned sessions
  already work through them unchanged. Anonymous sessions (owner-owned, no JWT) CANNOT
  use those endpoints — add token-scoped equivalents ONLY for: add set, finish. Route
  them as `POST /api/shared/{token}/sessions/{session_id}/sets` and
  `POST /api/shared/{token}/sessions/{session_id}/finish`, each verifying the session's
  `share_id` equals the resolved share's id (403 otherwise) and permission ≥ `log`.
  Nothing else (no delete/discard for anonymous — out of scope).

**Stats-pollution rule (required, this is the whole point of the attribution design):**
`GetWorkoutHistory`, `GetExerciseProgress` (and the dashboard recent-workouts, which goes
through `GetWorkoutHistory`) currently select by `user_id`. They must EXCLUDE sessions
where `share_id IS NOT NULL AND (logged_by_user_id IS NULL OR logged_by_user_id !=
user_id)`. Effect: anonymous-logger sessions attached to the owner do NOT pollute the
owner's history/PRs/streaks; a recipient's own share-logged sessions (logged_by = self)
DO count in the recipient's stats. Implement as a repository-level filter, not scattered
in use cases.

- **Do NOT build any "trainer logs while impersonating the client" UI or endpoint.** The
  trainer-for-client use case is served by: trainer shares plan → client (or anonymous
  gym buddy) logs via the link. Explicit impersonation needs UI/UX design that hasn't
  happened. Out of scope; do not invent it.

**Required tests (backend):** recipient with `log` starts via share → session has
recipient's user_id + share_id + logged_by; recipient with only `view` → 403; anonymous
+ `anyone`(log) start → session has OWNER's user_id, share_id set, logged_by NULL;
anonymous add-set + finish through the token-scoped endpoints work, and are rejected
(403) for a session whose share_id doesn't match; owner's `GetWorkoutHistory` excludes
the anonymous-logged session but still includes the owner's own ordinary sessions;
recipient's history INCLUDES their share-logged session; `GetExerciseProgress` for the
owner excludes anonymous-logged sets' sessions.

## Phase 5 — Frontend

Use the existing UI vocabulary (Modal, Toast, ConfirmDialog, existing button classes,
same inline-style approach). Mobile responsive like the rest of the app (768px breakpoint
pattern). New API module `frontend/src/api/sharingApi.ts`.

1. **Share dialog** — a "Share" button on each plan card in `PlanList.tsx` (next to
   Start/Edit). Opens a Modal: create/enable share; mode toggle ("Restricted" /
   "Anyone with the link"); link-permission picker shown when mode=anyone
   (View/Log/Edit); copy-link button (`navigator.clipboard.writeText`, toast on success)
   with the URL `${window.location.origin}/shared/<token>`; username input + tier picker
   + "Share" (surface the backend's "User not found" error inline); list of current
   grants with per-row tier + remove; "Stop sharing" (revoke) with ConfirmDialog.
2. **Shared plan page** — new route `/shared/:token` in `App.tsx`, **NOT wrapped in
   `ProtectedRoute`** (anonymous must reach it). Fetches `GET /api/shared/{token}`.
   ⚠ Use a plain axios call or a dedicated instance WITHOUT the 401-redirect interceptor
   for the anonymous-capable calls, and attach the Authorization header manually when a
   token exists in localStorage — an anonymous viewer must never be redirected to /login,
   and a logged-in viewer must still be recognized for restricted shares.
   Renders the plan read-only (name, days/weeks, exercises — reuse existing display
   components where practical). Shows a banner: "Shared by <owner> — you can
   <view/log/edit>". 404/403 render friendly full-page messages ("This link is invalid
   or no longer shared" / "This share is restricted — log in with an account that has
   access"), never a blank page or a login bounce.
3. **Log via share** — if permission ≥ `log`, a "Start workout" flow from the shared
   page: pick a day (reuse the SessionSetup patterns), call
   `POST /api/shared/{token}/start`. Authenticated users then navigate to the normal
   `/workout-sessions/{id}` Active Workout (their session, standard endpoints).
   Anonymous users get a minimal in-page logging view driven by the token-scoped
   endpoints (list the day's exercises, log sets, finish) — reuse `ActiveWorkout` if its
   props allow injecting custom API handlers cheaply; otherwise a simple purpose-built
   component is acceptable. Do NOT rework `ActiveWorkout` for this.
4. **Edit via share** — if permission = `edit` AND the viewer is authenticated, show an
   "Edit plan" button linking to the existing plan-builder route for that plan. This
   requires the workouts plan-detail/edit endpoints to accept share-authorized editors —
   add a lightweight authorization pass in the workouts routes: where they currently
   check `plan.user_id == user_id`, also allow a caller holding an `edit`-tier share
   grant on that plan (write ONE helper for this and call it; do not copy-paste the check
   into a dozen handlers). **Anonymous edit** (mode=anyone + edit): out of scope for the
   plan-builder UI (it assumes auth throughout); anonymous editors simply don't get the
   Edit button. This is an accepted, documented limitation — note it in your report.

**Required tests (frontend, real render + assert, no placeholders):** Share dialog
opens, calls create-share, displays the copyable link; granting a username calls the API
and renders the new grant; "User not found" error surfaces inline; shared page renders
plan content from a mocked resolve response and shows the permission banner; shared page
with a 403 mock renders the restricted message and does NOT navigate to /login (assert
no redirect); permission=view hides the Start-workout UI, permission=log shows it; the
existing full suite still passes.

---

## Final acceptance (after all phases)

- [ ] Full backend suite + full frontend suite + `npx tsc -b` all green — paste real counts.
- [ ] Live-verify end-to-end locally with two real accounts + one incognito/anonymous
      pass: owner shares restricted→grant user→user logs; owner switches mode to
      anyone/edit→anonymous opens link, views, logs a set, finishes; owner's history does
      NOT show the anonymous session; recipient's history DOES show theirs. Document each
      check in the report.
- [ ] No migration files added/changed; nothing pushed; production untouched.
- [ ] Zero placeholder tests anywhere in the diff (reviewer will grep for
      `expect(true)` and inspect every new test body — a single fake test fails the task).
