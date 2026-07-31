# Task 63 — Backend: expose muscle_group and equipment on WorkoutExerciseDetailedResponse

## Objective
Add `muscle_group` and `equipment` fields to `WorkoutExerciseDetailedResponse`, mirroring exactly how `video_url` was added in Task 56. This is the one backend prerequisite for the Active Workout exercise-preview feature (Tasks 64-67) — the new preview panel needs to show muscle-group/equipment tag pills alongside the video, and neither field is exposed on this response today (confirmed via direct grep: only `video_url` exists).

## Context
- `backend/src/modules/workouts/presentation/schemas.py:137` — `WorkoutExerciseDetailedResponse` currently has `video_url: str | None = None` and nothing else from the exercise entity.
- `backend/src/modules/workouts/presentation/routes.py:109-156` — `_build_workout_exercise_response()`, the same shared helper Task 56 touched. When `include_exercise_name=True` (lines 135-156), it already fetches `exercise_entity` via `ExerciseRepositoryImpl(db).get_by_id(exercise.exercise_id)` (line 137) and reads `exercise_entity.video_url` (line 139). `Exercise` domain entity (`backend/src/modules/exercises/domain/entities/exercise.py:13,15,23,25`) already has `muscle_group` and `equipment` fields — no entity/repository changes needed, just read two more attributes off the same object already in scope.
- This helper is used by all 3 call sites with `include_exercise_name=True` (`build_plan`, `get_workout_plan_detail`, `add_exercise_to_day`) — fixing the shared helper automatically covers all of them, same as Task 56.
- `frontend/src/api/workoutPlansApi.ts:29` — the `WorkoutExercise` TypeScript interface already has `video_url?: string | null;` from Task 56; it does not yet have `muscle_group`/`equipment` — that's frontend work for Task 65, not this task, but keep the field names identical (`muscle_group`, `equipment`) so the frontend types line up directly.

## Requirements
- Add `muscle_group: str | None = None` and `equipment: str | None = None` to `WorkoutExerciseDetailedResponse` (`schemas.py:137`, alongside `video_url`).
- In `_build_workout_exercise_response()` (`routes.py:135-156`), read `exercise_entity.muscle_group` and `exercise_entity.equipment` the same way `video_url` is read (line 139), and pass them into the `WorkoutExerciseDetailedResponse(...)` construction (alongside `video_url=video_url` at line 154).
- Do not touch `WorkoutExerciseResponse` (the non-detailed variant) — same scoping rule Task 56 followed.

## Do NOT
- Do not touch the `Exercise` domain entity, repository, or any exercise_library code — the data already exists, this task only threads two more already-available fields through one response schema and one builder function.
- Do not add these fields to `WorkoutExerciseResponse` (only the Detailed variant, matching `video_url`'s existing scope).

## Acceptance criteria
- [ ] `GET /api/workout-plans/{id}` (or the build/add-exercise routes that return `WorkoutExerciseDetailedResponse`) now include `muscle_group` and `equipment` in the JSON response for each exercise, live-verified via a real request (curl or equivalent), not just a code read.
- [ ] Existing backend tests still pass; add or extend a test asserting these two fields are present and correctly populated on a real exercise with known `muscle_group`/`equipment` values.
- [ ] `WorkoutExerciseResponse` (non-detailed) is confirmed unchanged.

## Review checklist
- [ ] Live-verify with a real API call (e.g. via the already-running dev backend) that both new fields appear with correct values for an exercise you know has non-null `muscle_group`/`equipment` set — don't just trust that the code "should" work.
