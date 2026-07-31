# Task 50 — Backend: Update (edit) a custom exercise

## Objective
Add the ability to edit an existing custom exercise's fields. This did not exist before — the `exercises` module currently only supports Create, List, Delete. Depends on Task 49 (needs `muscle_group`/`equipment`/`video_url` to exist first).

## Context
- `ExerciseRepository` interface (`backend/src/modules/exercises/domain/interfaces/exercise_repository.py`) currently has: `create`, `list_by_user`, `get_by_id`, `delete`, `is_used_in_any_plan`, `exists_by_user_and_name`. No update method.
- Follow the exact layering already used by `CreateExercise`/`DeleteExercise` (`backend/src/modules/exercises/application/use_cases/`) — presentation → application → domain → infrastructure, domain has no framework imports.
- Ownership check pattern already exists in `DeleteExercise` (`backend/src/modules/exercises/application/use_cases/delete_exercise.py`) — reuse the same `UnauthorizedExerciseAccessError` if the requesting user doesn't own the exercise.
- Duplicate-name check pattern already exists in `CreateExercise` via `exists_by_user_and_name` — an edit that renames an exercise should use the same check (excluding the exercise's own current row) so you can't rename into a collision with another of your own exercises.

## Requirements
1. Add `update(self, exercise: Exercise) -> Exercise` to `ExerciseRepository` (interface + `ExerciseRepositoryImpl`), and add it to `InMemoryExerciseRepository` in `backend/tests/conftest.py` too (same lesson as Task 49 — a test double implementing this interface will break if it's missing this method).
2. New `UpdateExercise` use case (`backend/src/modules/exercises/application/use_cases/update_exercise.py`): takes `exercise_id`, `requesting_user_id`, and the new field values (`name`, `muscle_group`, `equipment`, `video_url` — `logging_type` stays as-is, not part of this edit flow unless already exposed elsewhere). Raises `ExerciseNotFoundError` if missing, `UnauthorizedExerciseAccessError` if not owned by the requester. If `name` is changing, check for a duplicate under the same rules as `CreateExercise` (excluding this exercise's own id).
3. New `PUT /api/exercises/{exercise_id}` route in `backend/src/modules/exercises/presentation/routes.py`, using an `UpdateExerciseRequest` schema (same shape as `CreateExerciseRequest` minus requiring name to be non-empty if provided — actually keep name required, same validation as create) with the same YouTube validator from Task 49 applied to `video_url`.
4. Response: reuse the existing `ExerciseResponse` schema.

## Do NOT
- Do not touch `logging_type` handling — leave it exactly as-is.
- Do not touch the Delete or List endpoints.
- Do not add any frontend code — that's a later task.
- Do not change how `is_used_in_any_plan`/delete-blocking works — this task is only about editing fields, not usage restrictions. (An exercise already in use CAN be edited — only deletion is blocked when in use.)

## Acceptance criteria
- [ ] `PUT /api/exercises/{id}` updates the exercise's fields and returns the updated `ExerciseResponse`.
- [ ] Editing an exercise you don't own returns an authorization error, not a silent success.
- [ ] Editing to a name that collides with another of your own exercises is rejected the same way `CreateExercise` rejects a duplicate on create.
- [ ] Editing an exercise that's already used in a workout plan still succeeds (only Delete is blocked by usage, not Edit).
- [ ] Invalid (non-YouTube) `video_url` on update is rejected the same way as on create.
- [ ] **Full backend test suite passes**, including new unit tests for `UpdateExercise` (success, not-found, unauthorized, duplicate-name, YouTube validation) — not just a manual check.

## Review checklist
- [ ] Confirm `InMemoryExerciseRepository` in conftest.py has the new `update` method (same class of bug as Task 49's equipment method).
- [ ] Confirm the route requires auth the same way create/delete already do.
