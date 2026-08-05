# Task 90 — Sharing Phase 5b: start/log a workout through a shared plan

## READ THIS FIRST — strict execution rules (non-negotiable)

1. **A test that does not render the real component and assert on real output is a task
   failure.** No placeholder assertions. Every test must `render()` the actual component
   and assert on rendered text/elements/mock-call-arguments.
2. **Run, do not claim.** Run the FULL frontend suite (`npx vitest run` from `frontend/`)
   and `npx tsc -b`. Paste real output. Baseline before your change: **190 passed** (from
   Phase 5a). After your change: 190 + your new tests, no new failures.
3. **File allowlist below — do not touch anything outside it.** If you believe another
   file must change, STOP and ask.
4. **This is Phase 5b only.** Do NOT build the "Edit via share" button or touch any
   plan-builder file — that is Phase 5c, a separate later task. Do NOT modify
   `ActiveWorkout.tsx` or `ActiveWorkoutPage.tsx` — the authenticated-recipient path reuses
   them entirely unmodified (see Part 1 below), it does not need changes.
5. **No backend changes.** All three endpoints this phase needs already exist and are
   verified working (Task 87): `POST /api/shared/{token}/start`,
   `POST /api/shared/{token}/sessions/{session_id}/sets`,
   `POST /api/shared/{token}/sessions/{session_id}/finish`. Do not modify any backend file.
6. **No `git push`, no deploy.** Local commit only.
7. **The 401-redirect hazard still applies here, same as Phase 5a.** All three endpoints
   above accept an OPTIONAL `Authorization` header (present for a logged-in recipient,
   absent for an anonymous visitor) and must NEVER trigger the global 401-redirect
   interceptor in `frontend/src/api/client.ts`. Use `publicClient` (already created in
   Phase 5a at `frontend/src/api/publicClient.ts`, no interceptor) for all three calls,
   manually attaching `Authorization: Bearer <token>` from
   `localStorage.getItem('auth_token')` only when present — exactly the same pattern
   `sharingApi.getSharedPlan()` already uses. Do not use the interceptor-bearing `client`
   for these three calls.

## File allowlist (do not touch anything else)

New files:
- `frontend/src/features/sharing/ShareWorkoutStarter.tsx`
- `frontend/src/features/sharing/ShareWorkoutStarter.test.tsx`
- `frontend/src/features/sharing/AnonymousWorkoutLogger.tsx`
- `frontend/src/features/sharing/AnonymousWorkoutLogger.test.tsx`

Modified files:
- `frontend/src/api/sharingApi.ts` (add 3 new functions + types — see below; do not touch
  the existing share-management functions from Phase 5a)
- `frontend/src/pages/SharedPlanPage.tsx` (render `ShareWorkoutStarter` when permission
  allows; wire up the post-start branching described in Part 1/Part 2)
- `frontend/src/pages/SharedPlanPage.test.tsx` (add tests for the new behavior — do not
  rewrite existing Phase 5a tests)

## Backend reference (read-only — do not modify, already verified working)

- `POST /api/shared/{token}/start` — auth optional. Body: `{plan_day_id: number,
  week_number?: number}` (`week_number` only for weeks-type plans — same as the existing
  normal start-workout flow's day/week resolution). Response `201`:
  `{session_id: number, message: string}`. `403` if effective permission is below `log`.
  `404` if token missing/revoked.
- `POST /api/shared/{token}/sessions/{session_id}/sets` — auth optional (must match
  whatever auth state, or lack of it, was used for `/start` — i.e. an anonymous-started
  session is logged into anonymously; an authenticated recipient's session is logged into
  with their token). Body: `{exercise_id: number, weight?: number, reps?: number,
  duration_seconds?: number, notes?: string}`. Response `201`:
  `{set_id: number, set_number: number}`.
- `POST /api/shared/{token}/sessions/{session_id}/finish` — auth optional, same matching
  rule. No body. Response `200`: `{message: string}`.

**Attribution reminder** (already correct on the backend, just context for why the
frontend branches the way it does): if the visitor is authenticated, the session belongs
to THEM (`user_id = caller`) — so after starting, they should be sent to the app's normal,
already-fully-built Active Workout screen at `/workout-sessions/{session_id}`, which uses
the standard authenticated endpoints and requires no changes. If the visitor is anonymous,
there is no "their account" for the session to live in the normal sense — the session
attaches to the plan owner internally, and the frontend has no authenticated screen to
send them to, so it needs its own minimal, purpose-built logging view.

## Part 1 — `sharingApi.ts` additions

Add to the existing `sharingApi` object (do not restructure the file, just add):
```ts
export interface StartWorkoutViaShareRequest {
  plan_day_id: number;
  week_number?: number;
}
export interface StartWorkoutViaShareResponse {
  session_id: number;
  message: string;
}
export interface AddSetViaShareRequest {
  exercise_id: number;
  weight?: number;
  reps?: number;
  duration_seconds?: number;
  notes?: string;
}
export interface AddSetViaShareResponse {
  set_id: number;
  set_number: number;
}

// in sharingApi:
async startWorkoutViaShare(token: string, req: StartWorkoutViaShareRequest): Promise<StartWorkoutViaShareResponse> { ... }
async addSetViaShare(token: string, sessionId: number, req: AddSetViaShareRequest): Promise<AddSetViaShareResponse> { ... }
async finishWorkoutViaShare(token: string, sessionId: number): Promise<{ message: string }> { ... }
```
All three MUST use `publicClient` with the manual-Authorization-header pattern described
in rule 7 — copy the exact pattern already used in `getSharedPlan()`.

## Part 2 — `ShareWorkoutStarter.tsx`

A component rendered inside `SharedPlanPage.tsx`, shown only when the loaded share data's
`permission` is `"log"` or `"edit"` (not `"view"`). Props: the already-fetched
`SharedPlanResponse` data (plan/days/weeks) and the `token`.

Behavior:
- Shows a "Start workout" button.
- Clicking it reveals a day picker: if `unit_type === 'days'`, a simple list of days to
  choose from (label + order_position, skip is_rest days or show them disabled — match
  whatever `SessionSetupPage.tsx` does for rest days, check that file for the existing
  convention rather than inventing a new one). If `unit_type === 'weeks'`, a week selector
  first, then a day selector within the chosen week (mirror
  `frontend/src/pages/SessionSetupPage.tsx`'s `selectedWeekIndex`/`selectedDayIndex`
  pattern — it already solves this exact UI problem for the normal flow, reuse the
  approach, not necessarily the code).
- A "Begin" button calls `sharingApi.startWorkoutViaShare(token, {plan_day_id,
  week_number?})`.
- On success, branch on whether `localStorage.getItem('auth_token')` is present:
  - **Present (authenticated recipient)**: navigate to
    `/workout-sessions/{session_id}` using `useNavigate()` from react-router-dom. That
    route is already `ProtectedRoute`-wrapped and renders the existing, unmodified
    `ActiveWorkoutPage`/`ActiveWorkout` — since the session now belongs to this user, it
    works exactly like any normal workout session from here. Nothing else to build for
    this path.
  - **Absent (anonymous)**: do NOT navigate anywhere (there's nothing authenticated to
    navigate to). Instead, switch to rendering `AnonymousWorkoutLogger` (Part 3 below),
    passing it the `session_id`, `token`, and the chosen day's exercise list (from the
    already-loaded plan data — no extra fetch needed).
- On a `403` from `startWorkoutViaShare` (shouldn't normally happen since the button is
  gated on `permission`, but the share could have been revoked/downgraded between page
  load and click), show an inline error message, do not crash, do not redirect.

## Part 3 — `AnonymousWorkoutLogger.tsx`

A minimal, self-contained, purpose-built logging view — this does NOT need to look or
behave like the full `ActiveWorkout.tsx`, it just needs to work. Props: `token`,
`sessionId`, and the list of exercises for the chosen day (each with at least
`exercise_id`, `exercise_name`, and optionally `has_reps`/`has_weight`/`has_duration` flags
if present in the shared plan data — if those flags aren't present in the payload, just
show weight/reps/notes inputs for every exercise unconditionally, simplicity over
precision here is fine).

Behavior:
- For each exercise, a simple set-entry form: weight input, reps input, notes input (all
  optional, matching backend validation — at least one of weight/reps/duration must be
  provided per set, surface a validation message if the user tries to submit all-empty).
- "Log set" button per exercise calls `sharingApi.addSetViaShare(token, sessionId,
  {exercise_id, weight, reps, notes})`. On success, show the logged set in a simple list
  under that exercise (set number + values) and clear the input for the next set.
- A "Finish workout" button at the bottom calls `sharingApi.finishWorkoutViaShare(token,
  sessionId)`. On success, replace the whole view with a simple "Workout complete — thanks
  for logging your workout!" message. No navigation anywhere — there is nowhere
  authenticated to send an anonymous visitor.
- No account creation prompt, no login prompt, no nagging — the spec deliberately keeps
  anonymous logging frictionless. If you're tempted to add a "sign up to save this"
  banner, don't — out of scope, not requested.

## Required tests

`ShareWorkoutStarter.test.tsx`:
1. Not rendered (or renders nothing actionable) when `permission === 'view'`.
2. Rendered with a working day picker when `permission === 'log'`, for a `days`-type plan.
3. Rendered with week+day picker for a `weeks`-type plan.
4. Clicking "Begin" calls `startWorkoutViaShare` with the correct `plan_day_id` (and
   `week_number` for weeks-type).
5. On success with `auth_token` present in localStorage, navigates to
   `/workout-sessions/{session_id}` (mock `useNavigate`, assert it was called with the
   right path).
6. On success with no `auth_token`, does NOT navigate, and renders
   `AnonymousWorkoutLogger` instead (assert its presence, or assert the starter's own UI
   is replaced — whichever is cleaner given your implementation split).

`AnonymousWorkoutLogger.test.tsx`:
1. Renders the exercise list passed in via props.
2. Logging a set calls `addSetViaShare` with the correct payload and the logged set
   appears in the rendered list.
3. Submitting a set with weight/reps/duration all empty shows a validation message and
   does NOT call the API (assert the mock was not called).
4. Clicking "Finish workout" calls `finishWorkoutViaShare` and replaces the view with the
   completion message.
5. Confirm no `useNavigate`/`window.location` call happens anywhere in this component's
   test suite — this is the anonymous path, there's nothing to redirect to.

`SharedPlanPage.test.tsx` additions:
6. Renders `ShareWorkoutStarter` when the mocked response's `permission` is `'log'` or
   `'edit'`, and does not render it (or its actionable UI) when `permission` is `'view'`.

## Acceptance criteria

- `npx vitest run` and `npx tsc -b` both clean, real counts pasted.
- Live-verify manually if possible (or via test, at minimum): an authenticated recipient
  starting via share lands on the normal Active Workout screen and can log/finish there
  using the existing, unmodified flow. An anonymous visitor starting via share gets the
  in-page logger, can log a set and finish, and is never redirected anywhere.
- No backend file touched, no migration, nothing pushed.
- Zero placeholder tests.
