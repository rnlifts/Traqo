# Task 89 — Sharing Phase 5a: Share dialog (owner side) + shared-plan viewing page (public)

## READ THIS FIRST — strict execution rules (non-negotiable)

Past phases of this project shipped placeholder tests and false verification claims, and
two real backend bugs slipped through because tests only ever exercised empty/happy-path
data. For this task:

1. **A test that does not render the real component and assert on real output is a task
   failure.** No `expect(true).toBe(true)`, no snapshot-only tests, no "verified by
   inspection" comments. Every test must `render()` the actual component (React Testing
   Library) and assert on rendered text/elements/mock-call-arguments.
2. **Run, do not claim.** Before reporting done: run the FULL frontend suite
   (`npx vitest run` from `frontend/`) and `npx tsc -b` (from `frontend/` — a separate
   check from vitest). Paste the actual final counts/output. If anything fails, fix it or
   report the failure honestly.
3. **File allowlist below — do not touch anything outside it.** If you believe another
   file must change, STOP and ask before touching it.
4. **This is Phase 5a only.** Do NOT build the "Start workout via share" flow, do NOT
   build the "Edit via share" button, do NOT touch `ActiveWorkout.tsx`,
   `SessionSetupPage.tsx`, or any plan-builder file. Those are Phase 5b/5c, separate tasks,
   coming later. If the shared-plan page's permission is `log` or `edit`, just note in the
   UI that logging/editing isn't available yet (or omit those buttons entirely) — do not
   build them now.
5. **No backend changes.** All backend endpoints this phase needs already exist and are
   verified working: `POST/GET/PUT /api/workout-plans/{plan_id}/share`,
   `POST /api/workout-plans/{plan_id}/share/revoke`,
   `POST/DELETE /api/workout-plans/{plan_id}/share/grants[/{username}]`,
   `GET /api/shared/{token}`. Do not modify any backend file.
6. **No `git push`, no deploy.** Local commit only.
7. **The 401-redirect hazard is real and load-bearing — read this carefully.**
   `frontend/src/api/client.ts` has a global response interceptor
   (`client.interceptors.response.use`) that on ANY 401 response clears `localStorage`
   (`auth_token`, `current_user`) and force-navigates to `/login`
   (`window.location.href = '/login'`). The backend's `GET /api/shared/{token}` NEVER
   returns 401 for a bad/anonymous request — it returns 403 (permission denied) or 404
   (missing/revoked), specifically so anonymous visitors are never bounced to login. But
   if you make the shared-plan page's API calls through the shared `client` instance and
   an anonymous visitor happens to hit some OTHER endpoint that does 401, or if a stale
   token is present and something else 401s, that visitor gets logged out and redirected
   away from the link they're trying to view. To prevent any risk of this: use a **separate
   axios instance** (or a plain `axios.get(...)` call) for calls made from the shared-plan
   page, WITHOUT the response interceptor, and manually attach
   `Authorization: Bearer <token>` only when `localStorage.getItem('auth_token')` is
   present. Do not import the interceptor-bearing `client` from `client.ts` into the
   shared-plan page or `sharingApi.ts`'s public-facing functions.

## File allowlist (do not touch anything else)

New files:
- `frontend/src/api/sharingApi.ts`
- `frontend/src/api/publicClient.ts` (a plain axios instance, no interceptor — see rule 7
  above; export it and reuse it for all of `sharingApi.ts`'s anonymous-capable calls)
- `frontend/src/features/sharing/ShareDialog.tsx`
- `frontend/src/features/sharing/ShareDialog.test.tsx`
- `frontend/src/pages/SharedPlanPage.tsx`
- `frontend/src/pages/SharedPlanPage.test.tsx`

Modified files:
- `frontend/src/features/workoutPlans/PlanList.tsx` (add a "Share" button per plan card,
  opens `ShareDialog`)
- `frontend/src/features/workoutPlans/PlanList.test.tsx` (add tests for the new button —
  do not rewrite existing tests)
- `frontend/src/App.tsx` (add the `/shared/:token` route — NOT wrapped in `ProtectedRoute`)

If you find you need a new shared UI primitive beyond `Modal`/`Toast`/`ConfirmDialog`
(all already exist in `frontend/src/components/`), STOP and ask instead of building one.

## Backend reference (read-only — do not modify)

- `POST /api/workout-plans/{plan_id}/share` — body `{}`, auth required (owner only, 403 if
  not owner). Creates or un-revokes the plan's share. Returns
  `{id, token, mode, link_permission, created_at, revoked_at, grants: [{username,
  display_name, permission}]}`. Default on creation: `mode="restricted"`,
  `link_permission="view"`.
- `GET /api/workout-plans/{plan_id}/share` — same shape. 404 if no share exists yet for
  this plan.
- `PUT /api/workout-plans/{plan_id}/share` — body `{mode?, link_permission?}` (either or
  both, `mode` is `"restricted"|"anyone"`, `link_permission` is `"view"|"log"|"edit"`).
  Same response shape.
- `POST /api/workout-plans/{plan_id}/share/revoke` — no body. Same response shape,
  `revoked_at` now set.
- `POST /api/workout-plans/{plan_id}/share/grants` — body
  `{username: string, permission: "view"|"log"|"edit"}`. Returns
  `{username, display_name, permission}`. 404 with `{"detail": "User not found"}` if
  username doesn't exist — surface this inline in the UI, not as a toast.
- `DELETE /api/workout-plans/{plan_id}/share/grants/{username}` — 204, no body.
- `GET /api/shared/{token}` — auth OPTIONAL (works with or without an `Authorization`
  header). Returns `200` with:
  ```
  {
    "plan": { "id", "user_id", "name", "unit_type", "total_units", "is_quick_start",
              "created_at", "updated_at" },
    "days": [ { "id", "label", "order_position", "is_rest",
                "exercises": [ { "exercise_id", "exercise_name", "order_number",
                                 "target_sets", "target_reps", "target_weight",
                                 "target_duration_seconds", "notes", ... } ] } ] | null,
    "weeks": [ ... same shape nested under weeks, or null ],
    "permission": "view" | "log" | "edit",
    "plan_owner_username": string,
    "share": { "mode": "restricted" | "anyone" }
  }
  ```
  Exactly one of `days`/`weeks` is populated depending on `plan.unit_type`.
  Returns `403` (`{"detail": "..."}`) if the caller lacks access (restricted share, no
  grant, or anonymous on a restricted share) — never 401. Returns `404` if the token is
  missing, garbage, or the share has been revoked.

## Part 1 — Share dialog (`ShareDialog.tsx`)

A Modal (use the existing `Modal` component from `frontend/src/components/Modal.tsx`,
which takes `isOpen`, `onClose`, `children`, `title?`) triggered by a new "Share" button on
each plan card in `PlanList.tsx`, placed next to the existing "▶ Start" / "Edit" buttons
(same button style conventions as those two — inspect their `style`/className usage and
match it, don't invent new button styling).

Behavior:
- On open, call `GET /api/workout-plans/{plan_id}/share`. If 404 (no share yet), show a
  "Create share link" button. If it exists, show the full management UI below.
- **Create**: calls `POST .../share`, then shows the management UI with the returned data.
- **Mode toggle**: "Restricted" / "Anyone with the link" (radio buttons or a toggle,
  reuse existing form styling conventions from the codebase — check
  `frontend/src/features/workoutPlans/PlanList.tsx` or `EditPlanPage`/`CreatePlanPage` for
  the established input styling). Calls `PUT .../share` with `{mode: "restricted"|"anyone"}`
  on change.
- **Link-permission picker**: shown only when mode is `"anyone"`. Three options
  (View/Log/Edit). Calls `PUT .../share` with `{link_permission: "view"|"log"|"edit"}` on
  change.
- **Copy link button**: always visible once a share exists (both modes — a restricted
  share's link is still useful to send to a person you're about to grant). Copies
  `${window.location.origin}/shared/${token}` via `navigator.clipboard.writeText`. On
  success, show a toast (`useToast` from `frontend/src/components/Toast.tsx`, same pattern
  as `PlanList.tsx` already uses) saying "Link copied".
- **Grant a user** (only meaningful in restricted mode, but don't hide it in anyone mode —
  a grant can still raise someone above the link tier): username text input + tier picker
  (View/Log/Edit) + "Share" button. Calls `POST .../share/grants`. On success, add the new
  grant to the visible list. On 404 "User not found", show that error message inline next
  to the input (not a toast, not an alert) — do not clear the input on error.
- **Grants list**: each row shows username, display_name, permission tier, and a "Remove"
  button. Remove calls `DELETE .../share/grants/{username}`, then removes the row from the
  list on success (204).
- **Stop sharing**: a "Stop sharing" button, wrapped in the existing `ConfirmDialog`
  component (`frontend/src/components/ConfirmDialog.tsx` — check its prop signature and
  match it) asking for confirmation before calling `POST .../share/revoke`. After revoke,
  show the "Create share link" state again (since `revoked_at` is now set — treat a
  revoked share the same as no share for the dialog's initial-state purposes, i.e. show
  "Create share link", but note: calling create again on an existing revoked share
  un-revokes it server-side, which is fine, that's the intended backend behavior — you
  don't need to do anything special client-side for this, the POST just works).

## Part 2 — Shared plan page (`SharedPlanPage.tsx`, route `/shared/:token`)

Add to `App.tsx`:
```tsx
<Route path="/shared/:token" element={<SharedPlanPage />} />
```
**Outside** any `<ProtectedRoute>` wrapper — anonymous visitors must be able to reach it.

On mount, read `token` from `useParams()`, call `GET /api/shared/{token}` via the
interceptor-free client (rule 7 above), manually attaching `Authorization: Bearer <token>`
from `localStorage.getItem('auth_token')` only if present (so a logged-in visitor is still
recognized on a restricted share, but an anonymous one sends no header at all).

States to handle:
- **Loading**: simple loading indicator (match existing page loading-state conventions,
  e.g. how `PlanList.tsx` handles its loading state).
- **404**: full-page friendly message: "This link is invalid or no longer shared." Do not
  render a blank page, do not redirect.
- **403**: full-page friendly message: "This share is restricted — log in with an account
  that has access." Do NOT navigate to `/login` automatically — just show the message (a
  manual link to `/login` in the text is fine and encouraged, but no auto-redirect).
- **200**: render:
  - A banner: `"Shared by {plan_owner_username} — you can {permission}."` (use the literal
    word from `permission`: "view"/"log"/"edit").
  - The plan name and unit_type.
  - If `days` is populated: list each day (label, order_position, is_rest) with its
    exercises (exercise_name, order_number, target_sets/reps/weight/duration if present).
  - If `weeks` is populated instead: same, nested under each week (week_number, mode,
    resolved_week_number if present in the payload, days as above).
  - Read-only rendering only — no edit controls, no start/log controls (Phase 5b/5c).
  - Reuse existing display markup/conventions where practical (e.g. how plan details are
    shown elsewhere in the app) rather than inventing a new visual style from scratch, but
    a purpose-built simple read-only list is fine if reuse isn't clean — use your
    judgment, this doesn't need to be pixel-identical to the authenticated plan-detail
    view.

## Required tests

`ShareDialog.test.tsx` (mock `sharingApi`, no real network calls):
1. Opens and, given no existing share, shows "Create share link"; clicking it calls the
   create API and then renders the management UI with the returned token.
2. Given an existing share, renders the copyable link, mode toggle, and grants list from
   the mocked `GET` response.
3. Changing mode to "anyone" calls `PUT` with `{mode: "anyone"}` and reveals the
   link-permission picker.
4. Granting a username calls `POST .../share/grants` and the new grant appears in the
   rendered list.
5. Granting a username that returns 404 "User not found" renders that error message
   inline (assert the text appears in the DOM near the input, not as a toast/alert).
6. Clicking "Stop sharing" opens the `ConfirmDialog`; confirming calls the revoke API.
7. Copy-link button calls `navigator.clipboard.writeText` with the correct URL (mock
   `navigator.clipboard.writeText`) and shows a "copied" toast.

`SharedPlanPage.test.tsx` (mock `sharingApi`/`publicClient`, no real network calls):
1. Renders plan content (day/week names, exercise names) from a mocked successful
   `GET /api/shared/{token}` response, for a `days`-type plan.
2. Same for a `weeks`-type plan.
3. Renders the permission banner with the correct owner username and permission word.
4. A mocked 403 response renders the restricted-access message and — this is the critical
   assertion — does NOT call `window.location.href` assignment / does NOT navigate to
   `/login` (assert no redirect happened; you may need to mock/spy on navigation to prove
   this negative).
5. A mocked 404 response renders the "invalid or no longer shared" message.
6. Confirm the component does NOT import the interceptor-bearing `client` from
   `../api/client` — this can be a simple source-inspection assertion, or just make sure
   your implementation genuinely doesn't import it (the review will check the import
   statements directly either way).

`PlanList.test.tsx` additions:
7. A "Share" button is rendered on each plan card and opens `ShareDialog` when clicked
   (mock `ShareDialog` or assert on its presence/props — whichever is cleaner given the
   existing test setup in this file).

Run the full frontend suite (`npx vitest run`) and confirm the pre-existing tests are
unaffected — paste the full before/after counts.

## Acceptance criteria

- `npx vitest run` and `npx tsc -b` both clean, real counts pasted, twice.
- Live-verify manually (or via test) that an anonymous visitor to `/shared/{token}` never
  gets redirected to `/login`, even on a 403.
- No backend file touched. No migration. Nothing pushed.
- Zero placeholder tests — every new test renders the real component.
