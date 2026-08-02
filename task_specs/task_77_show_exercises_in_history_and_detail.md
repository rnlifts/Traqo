# Task 77 — Show exercise history in Session Detail (even for deleted plans) and preview exercise names in the History list

## Objective
Two related additions, both sourcing exercise data the resilient way — directly from `workout_sets` (which survives plan/exercise deletion per Task 74), not from the plan structure:

1. **Session Detail page** currently shows "No exercises in this workout day" whenever the plan (or the specific day/exercise) has been deleted, even though the actual logged sets are safely in the database and already returned by the API. Fix it to always show what was actually logged.
2. **Workout History list** currently shows only date/workout-name/duration per entry, no indication of which exercises were done. Add a compact exercise-name preview to each row.

Validated against how Hevy (a direct competitor, already used as a UX reference in this project) is documented to behave: a completed workout is a self-contained record, decoupled from the routine/template it came from — full exercise/set/rep/weight detail always shows regardless of what happens to the source template afterward. This task brings Traqo in line with that.

## Part A — Session Detail: show logged sets even when the plan is deleted

### Confirmed root cause
`frontend/src/features/sessions/SessionDetail.tsx:92` — the entire exercises/sets section is gated on `matchingDay && matchingDay.exercises.length > 0`. `matchingDay` comes from the plan's day structure (`SessionDetailPage.tsx`) and is `null` whenever the plan was deleted (Task 74) — so the component falls straight to the empty state, never looking at the `sets` prop it already received, which does contain the real data (`exercise_name`, `weight`, `reps`, `set_number`, `notes` — all resolved server-side already, confirmed via `WorkoutSetWithExerciseResponse`).

The existing grouping strategy (`sets.filter(s => s.workout_exercise_id === exercise.id)`, line 97) is plan-centric — it iterates the plan's exercise list and matches sets to it via `workout_exercise_id`. That FK is `NULL` on any set whose plan/exercise was deleted (Task 74's own fix), so this approach fundamentally cannot recover once the plan is gone — there's neither an exercise list to iterate nor a reliable FK to join on.

### Required change
Add a second rendering path for when `matchingDay` is `null`:
- Group `sets` directly by `exercise_name` (not `workout_exercise_id`) — sets sharing the same `exercise_name` belong to the same exercise instance within that session.
- Within each group, sort by `set_number` and render exactly like the existing per-set rows do today (weight × reps, notes) — reuse the existing set-row JSX/styling, don't rebuild it.
- **No "Target: X sets × Y reps" line** in this path — that data lives on `workout_exercises` (the plan structure), which no longer exists. Only show what was actually logged, not what was targeted. This is an intentional, honest limitation — don't try to reconstruct or guess target values.
- Keep the existing `matchingDay`-based path completely untouched for the normal case (plan still exists) — it already correctly shows target lines and plan-defined ordering; this task only adds a fallback, it doesn't replace the working path.

### Do NOT
- Do not change anything about how the existing (plan-exists) path renders — same styling, same target-line logic, same grouping-by-`workout_exercise_id`. This task is additive.
- Do not attempt to recover or fabricate target sets/reps/weight for the deleted-plan case — that data is genuinely gone; showing only actuals is correct, not a compromise to fix later.

## Part B — History list: preview which exercises were done

### Current state
`backend/src/modules/sessions/application/use_cases/get_workout_history.py` — `GetWorkoutHistory.execute()` only returns `date`, `workout_name`, `duration_minutes`, `session_id` per entry (see `WorkoutHistoryEntry` dataclass and `WorkoutHistoryEntryResponse` schema). No exercise information at all today.

### Required backend change
- Add `exercises: list[str]` to `WorkoutHistoryEntry` and `WorkoutHistoryEntryResponse` — the distinct exercise names logged in that session, in order of first appearance (not alphabetical — matches the order the user actually did them).
- `GetWorkoutHistory` currently takes only `session_repository` and `plan_repository`. Add `set_repository: WorkoutSetRepository` and `exercise_repository: ExerciseRepository` (same pattern already used in `GetWorkoutSessionDetail` and `GetExerciseProgress` — follow those for the DI wiring style). For each session, call `set_repository.list_by_session(session.id)`, resolve each set's `exercise_id` to a name via `exercise_repository.get_by_id(...)` (cache lookups per exercise_id within the loop — don't re-query the same exercise repeatedly across sets in the same session), and collect distinct names preserving first-seen order.
- Update the DI wiring in `backend/src/app.py` / `routes.py`'s `get_workout_history_handler` to construct and pass the two new repositories into `GetWorkoutHistory`.
- This must work correctly for deleted-plan sessions too (that's the whole point — it's sourced from `workout_sets.exercise_id`, which Task 74 confirmed survives plan/exercise deletion, not from plan structure).

### Required frontend change
- `frontend/src/api/workoutSessionsApi.ts` — add `exercises: string[]` to the `WorkoutHistoryEntry` type.
- `frontend/src/features/sessions/WorkoutHistory.tsx` — add a new field-group (matching the existing Date/Workout/Duration visual pattern, same icon-badge style) showing the exercise names, comma-separated. If there are more than 3, show the first 3 followed by `+N more` (e.g. "Bench Press, Squat, Deadlift, +2 more") rather than letting the row grow unbounded for a long session.
- A session with zero logged sets (shouldn't normally happen for a finished workout, but be defensive) should simply omit this field-group rather than show "Exercises: " with nothing after it.

### Do NOT
- Do not add set-level detail (weight/reps) to the history list — that's what "View Details" is for; this is a lightweight name-only preview.
- Do not change the "View Details" button/link behavior — untouched, still routes to the session detail page.

## Acceptance criteria
- [ ] Delete a plan that has logged history. Go to Workout History → click "View Details" on that session — the exercises and their logged sets are now visible (weight, reps, notes), not "No exercises in this workout day."
- [ ] The same deleted-plan session's row in the History *list* shows exercise names (e.g. "Bench Press, Squat"), not blank.
- [ ] A session on a plan that still exists is completely unchanged in both the list and detail views — same target lines, same grouping, same layout as before this task.
- [ ] A session with more than 3 distinct exercises shows the truncated "+N more" form in the list.
- [ ] Full frontend test suite passes; `npx tsc -b` clean. Backend test suite passes.

## Review checklist
- [ ] Live-verify both parts specifically against a session whose plan has actually been deleted (not just synthetic data with a plan still intact) — this is exactly the scenario that's easy to miss in testing since it requires deliberately deleting something first.
- [ ] Confirm the exercise-name resolution in `GetWorkoutHistory` doesn't do redundant per-set exercise lookups (N+1 query concern) — cache resolved names per exercise_id within a session's processing, and ideally across the whole history request if the same exercise appears in multiple sessions.
- [ ] Confirm a session with a mix of sets from an exercise that still exists and one that's been deleted (`exercise_id` itself was never deletable per Task 74's scope, so this shouldn't be possible for `exercise_id` — but double check `exercises.get_by_id` returning `None` is handled gracefully with a "Deleted Exercise" fallback, matching the existing pattern already used in `GetWorkoutSessionDetail`, rather than crashing).
