# Task 83 — Combine Active Workout's startup requests into one endpoint; keep previous-performance non-blocking

## Objective
`ActiveWorkoutPage.loadData()` (`frontend/src/pages/ActiveWorkoutPage.tsx:31-64`) currently makes **4 sequential** `await`ed requests before the page renders anything:
```
GET /workout-sessions/{id}              (session + sets)
GET /workout-plans/{planId}             (plan detail with days/weeks/exercises)
GET /exercises                          (full exercise list)
GET .../previous-performance?...        (last time this exercise was logged)
```
This was confirmed live in production logs: starting a workout fires this exact 4-call sequence (plus 3 browser CORS preflights), and it's fully serialized — each `await` blocks the next call from starting. On top of that, `GET /workout-plans/{planId}` is *already* fetched once by `SessionSetupPage` right before this (to show the day picker) — so the plan gets fetched twice across one "start workout" action, once per page.

This task does two things:
1. **Combine session + plan + exercises into one new backend endpoint**, cutting 3 sequential round trips down to 1 for the data the page actually needs before it can render anything.
2. **Keep `previous-performance` separate and non-blocking** — it's comparison data (last session's numbers shown next to each input), not required to render or use the page at all. `ActiveWorkout.tsx` already treats it as fully optional (`previousPerformance = null` default, guarded with `if (!previousPerformance...)` at lines 199 and 269) — so it should load in the background *after* the page is already usable, not hold up the initial render.

**Important scoping note, confirmed via research**: this backend uses fully synchronous SQLAlchemy (`backend/src/infrastructure/database.py` — plain `Session`, not `AsyncSession`). Combining these three calls into one endpoint reduces **network round trips** (1 instead of 3), which is the real win here, especially on mobile. It does **not** give you parallel/concurrent DB queries — the three use cases still run one after another inside the single request, just without the network latency between them. Don't try to force `asyncio.gather()` concurrency over blocking sync calls; that wouldn't do anything or could behave unexpectedly. If DB-level parallelism is ever wanted later, that requires wrapping each blocking call in `run_in_threadpool`, which is out of scope for this task — flag it as a future idea in the completion report if relevant, don't implement it.

## Backend changes

### New endpoint: `GET /api/workout-sessions/{session_id}/bootstrap`
Add to `backend/src/modules/sessions/presentation/routes.py`, after the existing `get_workout_session_detail` handler (~line 175). This is consistent with existing precedent in this codebase — the `sessions` module already imports from `workouts` and `exercises` in multiple use cases and in this same routes file, so pulling in `GetWorkoutPlanDetail` and `ListExercises` here is not a new architectural boundary violation.

The handler should, in order (still sequential — see the sync-DB note above):
1. Call `GetWorkoutSessionDetail` exactly as the existing `get_workout_session_detail` handler does (same repo instantiation, same use case call) to get session + sets.
2. Call `GetWorkoutPlanDetail` for `session.workout_plan_id` (guard for null — remember `workout_plan_id` is nullable since the Task 74 cascade-delete fix; if null, the plan-related fields in the response should be null/omitted, matching how `SessionDetailPage.tsx` already handles a deleted plan).
3. **Reuse, don't duplicate, the plan-detail response assembly.** The full days/weeks/exercises nesting logic currently lives inline in `workouts/presentation/routes.py:449-534` (the `_build_workout_exercise_response` helper at lines 109-176 plus the route body's day/week loop) — it is NOT currently part of `GetWorkoutPlanDetail` itself. Extract this assembly into a plain importable function (e.g. `build_workout_plan_detail_response(plan_id, user_id, db) -> WorkoutPlanDetailResponse`, living in `workouts/presentation/routes.py` or a new small module if that's cleaner) that both the existing `GET /workout-plans/{plan_id}` route and this new bootstrap handler call. Do not copy-paste the loop into two places.
4. Call `ListExercises` exactly as the existing `GET /exercises` handler does.
5. Return a new response schema (add to `backend/src/modules/sessions/presentation/schemas.py`):
   ```python
   class ActiveWorkoutBootstrapResponse(BaseModel):
       session: WorkoutSessionDetailResponse  # or its inner pieces, your call on nesting depth
       plan: WorkoutPlanDetailResponse | None  # null if workout_plan_id is null (deleted plan)
       exercises: list[ExerciseResponse]
   ```
   Match whatever nesting is cleanest given the existing schemas — the goal is the frontend gets everything it needs from one response, not a specific shape.

### Do NOT touch `previous-performance`
Leave `GET /workout-plans/{plan_id}/days/{day_id}/previous-performance` exactly as it is, as its own separate endpoint. It is deliberately excluded from the bootstrap response — see Objective above for why.

## Frontend changes

### `frontend/src/pages/ActiveWorkoutPage.tsx`
Rewrite `loadData()` (lines 31-64):
- Replace the first 3 sequential calls (`getSessionDetail`, `getWorkoutPlanDetail`, `exercisesApi.list`) with **one** call to the new bootstrap endpoint. Add a corresponding function to `frontend/src/api/workoutSessionsApi.ts` (e.g. `getActiveWorkoutBootstrap(sessionId)`), matching the existing patterns in that file.
- Set `loading = false` and render the page as soon as the bootstrap response resolves — do **not** wait for `previous-performance` before rendering.
- Fire `getPreviousPerformance(...)` as a separate, un-awaited (or awaited-but-not-blocking-render) call that updates `previousPerformance` state whenever it resolves. Since `ActiveWorkout.tsx` already renders correctly with `previousPerformance = null`, no new loading-state UI is strictly required — but consider whether a subtle "loading previous performance..." indicator near the affected fields is worth adding for clarity (your call; not a hard requirement, just don't make the user think there's no previous data when it's actually still loading — even a `previousPerformanceLoading` boolean passed through as a prop is fine if `ActiveWorkout.tsx` can use it to show a lightweight placeholder instead of nothing).
- If the previous-performance call fails, fail silently (log to console, don't show an error banner) — it's non-critical enrichment data, and a failure here should never block or degrade the actual workout-logging experience.

### `SessionSetupPage.tsx` — duplicate plan fetch
Out of scope for this task. `SessionSetupPage` fetching the plan once (for its own day-picker UI) and `ActiveWorkoutPage` fetching it again (now via bootstrap) after navigating is a separate, smaller inefficiency (one extra plan fetch, once per workout start) that doesn't justify the complexity of passing state across a route navigation for this task. Leave as-is; flag it as a possible future micro-optimization in the completion report if you want, but do not implement a fix for it here.

## Do NOT
- Do not add GraphQL, Apollo, urql, or any new query-layer dependency — this task is a plain REST aggregation endpoint using the existing stack.
- Do not attempt `asyncio.gather()` or other concurrency tricks around the three blocking sync DB calls inside the bootstrap handler — see the sync-DB note above.
- Do not duplicate the plan-detail response-assembly logic — extract and reuse it (see step 3 above). If you find this genuinely impractical to extract cleanly, stop and flag it in the completion report rather than duplicating ~90 lines of nesting logic into two files.
- Do not change `previous-performance`'s endpoint, its route, or its use case.
- Do not touch `SessionSetupPage.tsx`.

## Required tests
Per current testing policy:

**Backend:**
- `GET /workout-sessions/{id}/bootstrap` returns session, plan, and exercises in one response for a normal (non-deleted-plan) session — assert the shape matches what `GetWorkoutSessionDetail`, `GetWorkoutPlanDetail`, and `ListExercises` would each return individually (e.g. build the same fixtures used in those use cases' existing tests, if any exist, and compare).
- Same endpoint returns `plan: null` (not a 404 or 500) when the session's `workout_plan_id` is null (deleted-plan case) — regression test tying back to the Task 74 nullable-plan work.
- The endpoint 401s/404s appropriately for a session that doesn't belong to the requesting user or doesn't exist, matching the existing `get_workout_session_detail` handler's behavior.
- A test proving `GET /workout-plans/{plan_id}` (the original, pre-existing endpoint) still returns byte-for-byte the same shape as before this task — since its assembly logic got extracted into a shared function, this is the regression test that the extraction didn't change its behavior.

**Frontend:**
- `ActiveWorkoutPage` renders session/plan/exercise data from a single mocked bootstrap call, without any of the old 3 separate calls being made.
- The page renders (not stuck on a loading spinner) even while `getPreviousPerformance` is mocked as a permanently-pending promise — the core regression test that previous-performance no longer blocks initial render.
- Once the mocked `getPreviousPerformance` call resolves, the previous-performance data appears in the UI without a re-render of the whole page/re-fetch of anything else.
- A failed `getPreviousPerformance` call (mocked rejection) does not produce an error banner or block the page — matches the "fail silently" requirement above.

## Acceptance criteria
- [ ] Starting a workout results in 1 request for session+plan+exercises (via the new bootstrap endpoint) instead of 3 sequential ones, confirmed via network tab / log inspection matching the original screenshot's request pattern.
- [ ] The page is interactive as soon as the bootstrap response arrives — previous-performance data appears afterward without blocking anything.
- [ ] `GET /workout-plans/{plan_id}` (used elsewhere in the app — Plan Builder, History, etc.) is unaffected in behavior or response shape.
- [ ] A session whose plan was deleted still loads correctly (plan: null), matching existing Session Detail page behavior for the same case.
- [ ] Full backend and frontend test suites pass, including new tests; `npx tsc -b` clean.

## Review checklist
- [ ] Confirm the plan-detail assembly logic is genuinely shared (one implementation, two callers), not duplicated — diff both `workouts/presentation/routes.py` and wherever the bootstrap handler lives and check for copy-pasted day/week-loop logic.
- [ ] Confirm no `asyncio.gather()` or similar was added around the sync DB calls — flag it in review if present, since it wouldn't provide real concurrency here and would be misleading to a future reader.
- [ ] Live-verify: start a workout, check the network tab / Railway logs, and confirm the request count actually dropped from the original 4-call-plus-preflights pattern.
- [ ] Confirm previous-performance failing (simulate by temporarily breaking that one endpoint) doesn't block or error the rest of the page.
