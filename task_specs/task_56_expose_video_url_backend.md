# Task 56 — Backend: expose video_url in library search and plan-exercise responses

## Objective
Add `video_url` to two response shapes that currently don't have it: the Exercise Library search results (only send a pre-derived thumbnail image, not the playable video URL), and the plan-day-exercise detail response. This is the shared foundation for the upcoming Plan Builder preview panel — and, deliberately, for a future active-workout video feature too. Backend only.

## Context — why this is designed to serve two features, not just one
- `LibraryExerciseResponse` (`backend/src/modules/exercise_library/presentation/schemas.py`) currently returns `id`, `name`, `muscle_group`, `equipment`, `thumbnail_url` — no raw `video_url`. `thumbnail_url` is derived server-side via `derive_youtube_thumbnail()` in `exercise_library/presentation/routes.py`. The frontend needs the *raw* URL too, to actually play the video in a preview panel, not just show a static image.
- `WorkoutExerciseDetailedResponse` (`backend/src/modules/workouts/presentation/schemas.py`) is the response shape used for a plan day's exercises. **Confirmed by reading the actual frontend code**: `frontend/src/pages/ActiveWorkoutPage.tsx` calls the exact same `getWorkoutPlanDetail` endpoint (which returns `WorkoutExerciseDetailedResponse` objects) that the Plan Builder uses, and passes that data straight through as `planExercises` to `ActiveWorkout.tsx`. This means adding `video_url` here ONE time benefits both the Plan Builder preview (this feature) and a future active-workout video feature (not being built yet, but explicitly planned) — with zero additional backend work needed later for that second feature.
- `WorkoutExerciseDetailedResponse` is built in `_build_workout_exercise_response()` (`backend/src/modules/workouts/presentation/routes.py`, ~line 109-154). It already fetches the full `exercise_entity` via `ExerciseRepositoryImpl.get_by_id()` when `include_exercise_name=True` (to get `exercise_name`) — `exercise_entity.video_url` is already sitting right there in that same fetched object, unused.

## Requirements

### 1. `exercise_library` module: add `video_url` to search responses
- Add `video_url: str | None = None` to `LibraryExerciseResponse`.
- In the `search_library` route (`exercise_library/presentation/routes.py`), populate it directly from `item.video_url` (the raw field already on the domain entity) alongside the existing derived `thumbnail_url` — both fields present, don't replace one with the other.

### 2. `workouts` module: add `video_url` to the detailed plan-exercise response
- Add `video_url: str | None = None` to `WorkoutExerciseDetailedResponse`.
- In `_build_workout_exercise_response()`, when `include_exercise_name=True`, set `video_url=exercise_entity.video_url` (the entity is already fetched at that point — this is a one-line addition, not a new query).
- Do NOT add this to the plain `WorkoutExerciseResponse` (the non-detailed variant, used for routes that don't already do the exercise-name lookup) — only the `Detailed` variant, matching the existing pattern for `exercise_name`.

## Do NOT
- Do not touch `exercises` module's own `ExerciseResponse` — it already has `video_url`, no change needed there.
- Do not add `muscle_group`/`equipment` to `WorkoutExerciseDetailedResponse` — out of scope, not needed for the preview panel or thumbnails (name + video_url is enough).
- Do not change how `derive_youtube_thumbnail()` / `thumbnail_url` works — it stays as-is, `video_url` is additive.
- Do not touch any frontend code — that's the next tasks.

## Acceptance criteria
- [ ] `GET /api/exercise-library` (search) responses include a real `video_url` field, verified against actual seeded data (not just an empty/null case).
- [ ] `GET /api/workout-plans/{id}` (plan detail) and any other route using `include_exercise_name=True` (check `build_plan`, `add_exercise_to_day` responses too, per the grep results in `routes.py`) include `video_url` for each exercise, matching what's stored on that exercise's own record.
- [ ] An exercise with no `video_url` set returns `null`, not an error or omitted field.
- [ ] Full backend test suite passes; add/update unit or integration tests covering the new field on both responses.

## Review checklist
- [ ] Confirm `video_url` is populated everywhere `WorkoutExerciseDetailedResponse` is actually constructed (there are multiple call sites in routes.py per the grep — `build_plan`, `get_workout_plan_detail`, `add_exercise_to_day` — not just one).
- [ ] Confirm no existing test asserting on `WorkoutExerciseResponse`'s exact field set broke from an unrelated change (there shouldn't be one, since this task doesn't touch that schema).
