# Task 28 — Backend: unresolved-session lifecycle + unrestricted plan delete

## Objective
Give every workout session a clear resolution state (finished, saved-and-exited-but-resumable, or discarded) instead of silently going nowhere when the user leaves via back button/tab close/refresh/power cut. Also remove the current hard block on deleting a plan that has logged sessions — plan delete should always fully succeed (with a frontend warning, handled in Task 29).

## Context
- `workout_sessions.completed_at` is the only state field that exists today (`backend/src/modules/sessions/infrastructure/models/workout_session_model.py`). A session with `completed_at = NULL` is functionally invisible: excluded from history (`list_finished_by_user`, `workout_session_repository_impl.py:39-46`), but still permanently blocks plan/day deletion via `exists_for_plan`/`exists_for_day` (`workout_session_repository_impl.py:48-53`), which are checked in `delete_workout_plan.py:40-43` and `delete_day.py:55-58`.
- We are deliberately NOT adding a new status column. "Unresolved" is simply `completed_at IS NULL`. A session becomes resolved by exactly one of: `FinishWorkout` (existing), a new `DiscardWorkoutSession` (this task), or just staying unresolved on purpose after "Save & Exit" (frontend, Task 29 — no backend call needed for that case, since sets already persist immediately on each `POST /workout-sessions/{id}/sets`).
- `workout_sets.workout_session_id` already has `ondelete='CASCADE'` (`backend/src/modules/sessions/infrastructure/models/workout_set_model.py:12-17`), so deleting a `workout_sessions` row already cleans up its sets automatically at the DB level.
- Confirmed via migration audit: **`workout_sessions.workout_plan_id`, `plan_days.workout_plan_id`, and `plan_weeks.workout_plan_id` do NOT have `ondelete='CASCADE'`** (see `backend/migrations/versions/add_workout_sessions_and_sets.py:28`, `add_plan_days.py:29`, `add_plan_weeks.py:47` — all plain `ForeignKeyConstraint(...)` with no `ondelete`). Postgres defaults to `NO ACTION`/RESTRICT, so today, deleting a `workout_plans` row while any `plan_days`/`plan_weeks`/`workout_sessions` reference it would fail with an `IntegrityError` even with the app-level guard removed. This must be fixed via migration before the app-level guard can be safely removed.

## Requirements

### 1. Migration: cascade-delete audit
Write a new Alembic migration (revision id ≤32 chars, e.g. `plan_cascade_deletes_001`) that alters the following FK constraints to add `ondelete='CASCADE'` (drop + recreate constraint, since Postgres can't `ALTER` an existing FK's delete rule in place):
- `workout_sessions.workout_plan_id` → `workout_plans.id`
- `plan_days.workout_plan_id` → `workout_plans.id`
- `plan_weeks.workout_plan_id` → `workout_plans.id`

Before writing the migration, **run a query against `information_schema` / `pg_constraint` locally** to find every foreign key referencing `workout_plans.id`, `plan_days.id`, and `plan_weeks.id`, and confirm which ones are already `CASCADE` (e.g. `workout_exercises.workout_plan_id` already is, per `add_plan_days.py:145`) vs. not. Add any other missing ones you find (e.g. `workout_sessions.plan_day_id` → `plan_days.id`, `workout_sessions.plan_week_id` → `plan_weeks.id`, `workout_exercises.plan_day_id` → `plan_days.id` if not already cascading) — do not assume the three listed above are the only gaps, verify against the real schema.

Update the corresponding SQLAlchemy model `Column(..., ForeignKey(...))` definitions to match (cosmetic — Alembic already controls the real DB constraint, but keep models truthful) where practical without turning this into a large diff.

### 2. Repository: two new methods
In `backend/src/modules/sessions/domain/interfaces/workout_session_repository.py`, add:
```python
@abstractmethod
def find_unresolved_by_user(self, user_id: int) -> "WorkoutSession | None":
    """Return the user's most recent session with completed_at IS NULL, or None."""

@abstractmethod
def delete(self, session_id: int) -> None:
    """Permanently delete a session and (via DB cascade) its sets."""
```
Implement both in `workout_session_repository_impl.py`, following the existing query style (see `exists_for_plan`/`get_most_recent_finished_for_day` for patterns). `find_unresolved_by_user`: filter `user_id=user_id, completed_at IS NULL`, order by `started_at desc`, `.first()`.

### 3. New use case: `DiscardWorkoutSession`
New file `backend/src/modules/sessions/application/use_cases/discard_workout_session.py`, mirroring `finish_workout.py`'s structure:
- Load session by id, raise `WorkoutSessionNotFoundError` if missing.
- Raise `UnauthorizedWorkoutSessionAccessError` if `session.user_id != user_id`.
- Raise `SessionAlreadyFinishedError` if `session.is_finished()` — discard only applies to unresolved sessions; a finished session's history should go through plan-delete (Task 29 covers the UI), not this endpoint.
- Call `self.session_repository.delete(session_id)`.

### 4. New use case: `GetUnresolvedSession`
New file `backend/src/modules/sessions/application/use_cases/get_unresolved_session.py`. Returns the enriched session dict (same `plan_name`/`day_label` enrichment already done for other session responses — check `get_workout_session_detail.py` or `start_workout`'s route handler for the exact enrichment pattern already in use) for the user's unresolved session, or `None`.

### 5. Block starting a new session while one is unresolved
In both `StartWorkout.execute()` (`start_workout.py`) and `QuickStartWorkout.execute()` (`quick_start_workout.py`), at the top of `execute()`, call `self.session_repository.find_unresolved_by_user(user_id)`. If it returns non-None, raise a new `UnresolvedSessionExistsError` (add to `backend/src/modules/sessions/domain/exceptions.py`) before creating anything.

### 6. New routes
In `backend/src/modules/sessions/presentation/routes.py`:
- `GET /api/workout-sessions/unresolved` → calls `GetUnresolvedSession`, returns `{"session": <enriched session or null>}`.
- `DELETE /api/workout-sessions/{session_id}` → calls `DiscardWorkoutSession`, returns `204 No Content`.

### 7. Exception handling
In `backend/src/app.py`, add an `@app.exception_handler(UnresolvedSessionExistsError)` returning `409` with a clear message, e.g. `"You have an unfinished workout — resolve it before starting a new one."` (follow the existing pattern used for `WorkoutPlanHasSessionsError` at `app.py:81`).

### 8. Remove the plan-delete block
In `backend/src/modules/workouts/application/use_cases/delete_workout_plan.py`, remove the `if self.session_repository.exists_for_plan(plan_id): raise WorkoutPlanHasSessionsError(...)` check (lines 40-43). Ownership check stays. `self.plan_repository.delete(plan_id)` should now succeed unconditionally (relying on the cascade migration from step 1) — verify `plan_repository.delete()` does a plain row delete and doesn't itself re-check for sessions.

## Do NOT
- Do not touch `DeleteDay`/`exists_for_day` or day-level delete behavior — that guard is unchanged and out of scope for this task.
- Do not add a `status` enum column — `completed_at IS NULL` remains the sole "unresolved" signal.
- Do not remove or change `exists_for_plan`/`exists_for_day` themselves (other code may still reference them) — just stop calling `exists_for_plan` from `delete_workout_plan.py`.
- Do not build any frontend changes — that's Task 29.
- Do not allow `DiscardWorkoutSession` to delete a *finished* session — that's a different, not-yet-built feature (deleting completed history entries individually). Raise `SessionAlreadyFinishedError` instead.

## Acceptance criteria
- [ ] Start a quick workout, log a set, do NOT finish it. Call `GET /api/workout-sessions/unresolved` — returns that session.
- [ ] While that session is unresolved, try to start a second workout (`POST /workout-sessions` or `/quick-start`) — returns `409` with a clear message, and no new plan/day/session rows are created (verify via DB query — confirms the `QuickStartWorkout` rollback-on-failure path, already present for other errors, also holds here or that the check happens before any row is created).
- [ ] Call `DELETE /api/workout-sessions/{id}` on that unresolved session — returns `204`; `workout_sessions` row and its `workout_sets` rows are gone (verify via DB query); the plan/day it belonged to are untouched (still exist).
- [ ] Call `DELETE /api/workout-sessions/{id}` on an already-finished session — returns an error (not a silent success), session is untouched.
- [ ] Create a real (non-quick-start) plan, start and finish a session on it with at least one logged set, then `DELETE /api/workout-plans/{id}` — succeeds (`204`/`200`), and the plan, its days, exercises, sessions, and sets are all gone from the DB (verify via direct query, not just the API response).
- [ ] Same test but for a quick-start plan with a finished, logged session — plan delete also succeeds and fully cascades.
- [ ] `GET /api/workout-sessions/unresolved` returns `{"session": null}` when the user has no unresolved session.

## Review checklist
- [ ] The new migration was actually run locally (`alembic upgrade head`) and the resulting FK constraints verified via `\d workout_sessions` / `\d plan_days` / `\d plan_weeks` in psql (or equivalent), not just assumed from the migration file.
- [ ] `alembic downgrade -1` from the new revision works cleanly (drops the CASCADE constraints back to plain).
- [ ] No use case imports across module boundaries beyond what's already established (sessions module may depend on workouts module interfaces, matching existing patterns like `delete_workout_plan.py`'s import of `WorkoutSessionRepository`).
- [ ] New revision id is ≤32 characters (learned the hard way earlier this project — anything longer silently rolls back the whole migration on the version-bookkeeping step).
