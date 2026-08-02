# Task 74 — Backend: stop destroying logged history on delete, and fix the "defaults to 3 sets" bug

## Objective
Two independent, verified bugs, both must be fixed:

1. Deleting a workout plan or a single exercise from a plan currently **cascade-deletes the user's own logged workout history** for it (sessions and sets), via `ON DELETE CASCADE` foreign keys. Deleting a plan *template* should never destroy what someone actually did in the gym. Change the relevant foreign keys to `ON DELETE SET NULL` so logged history survives, detached from the now-deleted plan/exercise.
2. A newly-added exercise has `target_sets = NULL` in the database until the user explicitly interacts with the set-builder (add/edit a set). `ActiveWorkout.tsx` falls back to `we.target_sets ?? 3` for pip count, so any exercise added and never touched shows **3 empty pips** instead of the correct 1. Fix by defaulting `target_sets` to `1` at creation time.

## Bug 1 — cascade delete destroys logged history

### Confirmed root cause
- `backend/migrations/versions/plan_cascade_deletes_001.py` deliberately added `ON DELETE CASCADE` to `workout_sessions.workout_plan_id`, `workout_sessions.plan_day_id`, `workout_sessions.plan_week_id` (previously `NO ACTION`).
- `backend/src/modules/workouts/application/use_cases/delete_workout_plan.py` — its own docstring says "cascades to sessions/days/exercises." Deleting a plan currently deletes every `workout_session` and `workout_set` ever logged against it.
- `backend/src/modules/sessions/infrastructure/models/workout_set_model.py` — `workout_exercise_id` has `ForeignKey("workout_exercises.id", ondelete="CASCADE")`. `remove_exercise_from_day.py` calls `.remove(workout_exercise_id)` directly — deleting one exercise from a plan cascade-deletes every logged set recorded against that exercise slot, even from workout sessions on completely different dates.

### Required change
Write a new Alembic migration that changes these foreign keys from `CASCADE` to `SET NULL`:
- `workout_sessions.workout_plan_id` → `SET NULL` (requires making the column nullable — check `WorkoutSessionModel`, it's currently `nullable=False`; this needs to become `nullable=True` in both the model and migration)
- `workout_sessions.plan_day_id` → `SET NULL` (already nullable)
- `workout_sessions.plan_week_id` → `SET NULL` (already nullable)
- `workout_sets.workout_exercise_id` → `SET NULL` (already nullable)

`workout_sets.exercise_id` (not nullable, points to `exercises`, independent of the plan structure) is untouched — it's what 1RM calculation actually keys off (`GetExerciseProgress`, confirmed in `get_exercise_progress.py`), so this fix doesn't require any change to progress/1RM calculation code at all.

### Do NOT
- Do not change `workout_sets.workout_session_id`'s cascade — a `workout_set` genuinely can't exist without its parent session; that one stays `CASCADE`.
- Do not touch `GetExerciseProgress` or any 1RM/progress calculation code — it already queries by `exercise_id`, which this change doesn't affect.
- Do not change anything about how plans/exercises are created or edited — this is purely about what happens to already-logged data when a plan/exercise is later deleted.

### Acceptance criteria
- [ ] Log a session against a plan, then delete the plan. The session and its sets still exist in the database afterward, with `workout_plan_id`/`plan_day_id`/`plan_week_id` now `NULL`.
- [ ] Log a session against a specific exercise, then remove that exercise from the plan (without deleting the whole plan). The logged sets for that exercise still exist, with `workout_exercise_id` now `NULL`.
- [ ] `GET` a user's exercise progress / 1RM for an exercise whose plan/exercise-slot was since deleted — still returns the correct historical values, unaffected.
- [ ] Existing plan/exercise deletion tests still pass (update any that specifically asserted the old cascade-delete behavior — check `backend/tests` for tests on `delete_workout_plan` / `remove_exercise_from_day` that assert sessions/sets are gone after deletion, since that assertion is precisely what's being deliberately reversed).

## Bug 2 — new exercises default to showing 3 sets

### Confirmed root cause
- `frontend/src/features/workoutPlans/PlanBuilder.tsx:494` — `handleQuickAddExercise` (the only live path for adding an exercise, since Task 70) explicitly passes `targetSets: null` into `addExerciseToCurrentDay`.
- `addExerciseToCurrentDay` (`PlanBuilder.tsx:428`) computes `const sets = targetSetsValue ? Number(targetSetsValue) : undefined;` — always `undefined` via this path.
- This flows to `target_sets: sets || null` in the create-mode draft (`PlanBuilder.tsx:440`) and to `addExerciseToDay(planId, ..., sets, ...)` in edit mode (`PlanBuilder.tsx:480`), which the backend (`add_exercise_to_day.py:35`, `target_sets: int | None = None`) happily stores as `NULL`.
- `ActiveWorkout.tsx:276` — `return we.target_sets ?? 3;` — turns that `NULL` into a wrong pip count of 3 for an exercise the user never configured past its default single Set 1.

### Required change
Default `target_sets` to `1` (not `null`/`undefined`) at the moment an exercise is added, in both:
- `addExerciseToCurrentDay`'s `sets` computation (`PlanBuilder.tsx:428`) — default to `1` when `targetSetsValue` is falsy, not `undefined`.
- Confirm the create-mode draft path (`PlanBuilder.tsx:440`, `target_sets: sets || null`) and the edit-mode `addExerciseToDay` call both end up persisting `1`, not `null`, once the above is fixed — trace both branches, don't assume fixing the one variable is sufficient if either branch has its own fallback logic.

### Do NOT
- Do not touch `handleAddSet`/`handleRemoveSet`/`handleUpdateSet` (Task 72/73's set-builder logic) — those already correctly derive and persist `target_sets` from the set list length once the user interacts with it. This task only fixes the *initial* value at creation, before any interaction.
- Do not touch `ActiveWorkout.tsx`'s `?? 3` fallback line itself — leave it as a safety net for any pre-existing legacy data with genuinely `NULL` `target_sets` (there's plenty in the dev database from before this fix); the fix is to stop *creating new* rows with `NULL`, not to change how the fallback behaves.

### Acceptance criteria
- [ ] Add a brand-new exercise to a plan (via the picker/"+Add"), do not touch the set-builder at all, save the plan, start the workout — Active Workout shows exactly 1 pip, not 3.
- [ ] Confirm this holds in both create-mode (building a new plan) and edit-mode (adding to an existing saved plan).
- [ ] Existing behavior for exercises that *do* get built up via "+ Add Set" is unchanged (still shows the correct count from Task 73's fix).
- [ ] Full frontend test suite passes; `npx tsc -b` clean. Backend test suite passes.

## Review checklist
- [ ] Live-verify both fixes end-to-end, not just via code read — this is exactly the class of bug (data-loss on delete, wrong default) that's easy to claim fixed without actually reproducing the original failure first.
- [ ] For Bug 1: confirm via a direct DB query (not just the API response) that the session/set rows genuinely still exist post-delete, with the FK columns null — don't trust an API 200 response alone.
- [ ] For Bug 2: confirm via the raw plan API response that `target_sets` is `1`, not absent/omitted (which could still evaluate as `null` on the frontend depending on serialization).
