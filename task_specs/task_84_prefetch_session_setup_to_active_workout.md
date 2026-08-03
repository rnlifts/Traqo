# Task 84 — Carry Session Setup's already-loaded data into Active Workout instead of re-fetching it

## Objective
`SessionSetupPage` (the "Day 1 · Upper Lower Split" day-picker screen shown right after clicking a plan's "Start" button) already fetches the full plan detail the moment it renders, to populate the day picker. Today, all of that gets thrown away the moment the user clicks "Begin Workout" — `ActiveWorkoutPage` mounts fresh and calls the Task 83 bootstrap endpoint, re-fetching the same plan detail (plus session + exercises) from scratch.

This task carries the already-loaded plan detail (and a newly-added exercises prefetch) forward from `SessionSetupPage` to `ActiveWorkoutPage` via React Router navigation state, so that by the time "Begin Workout" is clicked, only the one call that's actually unavoidable — creating the session (`POST /workout-sessions`) — remains on the critical path.

**This is frontend-only.** No backend changes — `GET /workout-sessions/{id}` (the plain session-detail endpoint, still present and untouched by Task 83) is reused as-is for the one piece of data that genuinely can't be known before the session exists.

## Why the session itself can't be prefetched
Do not pre-create the workout session (call `startWorkout`) speculatively when `SessionSetupPage` loads, and do not implement anything that does this implicitly. If the user loads the setup screen and then navigates away without clicking "Begin Workout" (picks a different plan, goes back, closes the tab), a speculatively-created session would be left in the database as a dangling "started but never touched" session — which would then surface as a false "You have an unfinished workout" banner on the Dashboard (`GetUnresolvedSession`) the next time the user logs in. The session must only be created on the actual "Begin Workout" click, exactly as today.

## Required changes

### `frontend/src/pages/SessionSetupPage.tsx`
1. Add exercise-list prefetching alongside the existing plan-detail fetch in `loadPlan()` (~line 25-41): fetch both in parallel (`Promise.all`) — `workoutPlansApi.getDetail(Number(planId))` (existing) and `exercisesApi.list()` (new). Store the result in a new `availableExercises` state.
2. In `handleBeginWorkout()` (~line 87-113) only — **not** `handleLogNewToday()`, see Do NOT below — after `workoutSessionsApi.startWorkout(...)` resolves with `session_id`, pass the already-loaded data through navigation state:
   ```ts
   navigate(`/workout-sessions/${response.session_id}`, {
     state: { prefetchedPlanDetail: planDetail, prefetchedExercises: availableExercises },
   });
   ```

### `frontend/src/pages/ActiveWorkoutPage.tsx`
1. Read navigation state via `useLocation()` from `react-router-dom`.
2. In `loadData()` (~line 30-63), branch on whether `location.state?.prefetchedPlanDetail` and `location.state?.prefetchedExercises` are both present:
   - **If present** (arrived via "Begin Workout" from Session Setup): call the plain `workoutSessionsApi.getSessionDetail(sessionId)` (the original endpoint, still exists, returns just `{session, sets}` — it's what the bootstrap endpoint itself calls internally) instead of `getActiveWorkoutBootstrap(...)`. Use `location.state.prefetchedPlanDetail` for `planDetail` and `location.state.prefetchedExercises` for `availableExercises` directly — no plan/exercises network call at all in this path.
   - **If absent** (arrived any other way — resuming from Dashboard's "Resume" button, a page refresh, a bookmarked/shared URL, browser back/forward): fall back to `workoutSessionsApi.getActiveWorkoutBootstrap(sessionId)` exactly as it does today. This path must be unchanged — it's the correctness fallback for every entry point that isn't "just clicked Begin Workout."
3. The previous-performance fetch (already non-blocking per Task 83) is unaffected either way — fire it the same way regardless of which branch was taken.

## Do NOT
- Do not apply this prefetch-passing to `handleLogNewToday()` (~line 116-141, the quick-start "log a new day right now" flow). That handler calls `workoutPlansApi.createDay(...)` to create a brand-new day **after** `planDetail` was already fetched — the local `planDetail` state does not contain that new day. If you pass it through navigation state anyway, `ActiveWorkoutPage`'s day resolution (`resolveSessionDay`) will fail to find the day that was just created. `handleLogNewToday` must continue to navigate with no state, so `ActiveWorkoutPage` falls back to the full bootstrap fetch (which will correctly see the newly-created day).
- Do not pre-create the session before "Begin Workout" is clicked — see the section above.
- Do not remove or change the bootstrap endpoint itself (`GET /workout-sessions/{id}/bootstrap`, Task 83) — it's still required as the fallback path for every non-Session-Setup entry point.
- Do not change `GET /workout-sessions/{id}` (plain session-detail endpoint) — reuse it as-is.
- Do not add any staleness/freshness check (e.g., re-validating the prefetched plan is still up to date) — the window between loading Session Setup and clicking Begin Workout is seconds, and this app already accepts similar small staleness windows elsewhere. Out of scope.

## Required tests
Per current testing policy:

**Frontend:**
- `SessionSetupPage`: `loadPlan()` fetches plan detail and exercises in parallel (assert both API mocks were called, and that they don't block each other — e.g. one resolving slowly doesn't delay the other's data becoming available if you choose to surface them independently, though a single combined loading state is fine).
- `SessionSetupPage`: clicking "Begin Workout" navigates with `state` containing `prefetchedPlanDetail` and `prefetchedExercises` matching what was loaded.
- `SessionSetupPage`: `handleLogNewToday` (quick-start path) navigates with **no** state — the regression test guarding against the Do NOT above.
- `ActiveWorkoutPage`: when rendered with mocked `location.state` containing prefetched data, calls `getSessionDetail` (not `getActiveWorkoutBootstrap`) and renders correctly using the passed-in plan/exercises — assert `getActiveWorkoutBootstrap` was never called in this path.
- `ActiveWorkoutPage`: when rendered with no `location.state` (or missing one of the two fields), falls back to `getActiveWorkoutBootstrap` exactly as before — regression test for every non-Session-Setup entry point (Dashboard resume, refresh, direct URL).

## Acceptance criteria
- [ ] Clicking "Begin Workout" from Session Setup results in only `POST /workout-sessions` + `GET /workout-sessions/{id}` on the way to the workout screen — no plan-detail or exercises call.
- [ ] Resuming an unfinished workout from the Dashboard, refreshing the Active Workout page, or opening a workout-session URL directly still works exactly as today (full bootstrap fetch, unaffected by this change).
- [ ] Quick-start's "log a new day right now" flow still correctly shows the newly-created day's data (not stale pre-creation plan data).
- [ ] No speculative session creation — a session is only ever created when "Begin Workout" (or quick-start's equivalent) is actually clicked.
- [ ] Full frontend test suite passes including new tests; `npx tsc -b` clean. Backend untouched — confirm zero backend file diffs.

## Review checklist
- [ ] Confirm `handleLogNewToday` was not touched to pass navigation state — this is the one place a naive "apply the same pattern everywhere" pass would introduce a real bug.
- [ ] Confirm the no-prefetched-state fallback path in `ActiveWorkoutPage` is byte-for-byte the same behavior as before this task (still calls bootstrap, still works for every other entry point).
- [ ] Live-verify: click through Start → Session Setup → Begin Workout and confirm (via network tab / Railway logs) that the plan-detail and exercises calls are gone from that path, while a Dashboard "Resume" click still shows the full bootstrap call as before.
