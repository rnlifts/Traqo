# Task 44 — Backend: custom exercise metadata (muscle group, equipment, YouTube link)

## Objective
Extend the per-user `exercises` table (a user's "custom exercises") to carry the same kind of metadata the shared exercise library already has — muscle group, equipment, and an optional YouTube demo link — so a later frontend task can let users fill these in when creating a custom exercise. Backend only; no frontend changes in this task.

## Context
- `exercises` table (`backend/src/modules/exercises/infrastructure/models/exercise_model.py`) currently has: `id`, `user_id`, `name`, `created_at`, `category` (nullable `String(50)`), `logging_type`.
- `category` was added in `add_category_to_exercises.py` with an intended fixed vocabulary (Chest/Back/Legs/Shoulders/Biceps/Triceps/Core/Glutes/Cardio/Full Body — see `backend/src/modules/exercises/presentation/schemas.py`'s `Literal[...]`), but **no frontend UI has ever set it** — confirmed by direct audit: every real call site (`PlanBuilder.tsx:388`, `ActiveWorkout.tsx:501`) only ever passes a name, never a category. It is always `NULL` in practice. The owner has approved repurposing this column rather than adding a new one alongside it.
- The shared exercise library (`exercise_library_items` table, `backend/src/modules/exercise_library/`) already has the detailed vocabulary we want to reuse: `muscle_group` (e.g. `chest`, `back`, `biceps`, `quads`, `hamstrings`, `glutes`, `abs`, `forearm`, `front_delt`, `side_delt`, `rear_delt`, `traps`, `calves`, plus a few filename/content mismatches like `quadriceps`, `rear delts` — the real, authoritative list is whatever `GetMuscleGroups` returns, not the JSON filenames) and `equipment` (free-text, e.g. `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `smith machine`, `ez bar`, `leg press`, `belt squat`, `t-bar`, `trap bar`, `glute ham developer`, `assisted pull-up machine`, `assisted dip machine`, `back extension`, `slant board`).
- `exercise_library` already has a working `GET /api/exercise-library/muscle-groups` endpoint (`GetMuscleGroups` use case, `get_distinct_muscle_groups()` on the repository) that returns the sorted distinct muscle groups actually present in the seeded library. There is no equivalent for equipment yet — this task adds one, following the exact same pattern.
- `exercise_library`'s routes.py already has a `derive_youtube_thumbnail(video_url)` helper that recognizes `youtube.com/watch` and `youtu.be/` URL shapes — reuse this recognition logic (or extract it to somewhere shared) rather than reinventing YouTube-URL detection.

## Requirements

### 1. Migration: repurpose `category` → `muscle_group`, add `equipment` and `video_url`
- New Alembic migration (follow existing naming/pattern in `backend/migrations/versions/`).
- Rename the `exercises.category` column to `exercises.muscle_group` (keep it a nullable `String`; no data migration needed since it's confirmed always `NULL` today — but do not simply drop+recreate if a plain rename is available, to be safe about any environment where it might not be NULL).
- Add `equipment` (`String(100)`, nullable) and `video_url` (`String(500)`, nullable) columns to `exercises`.
- Update `exercise_library_001`-style downgrade() as well, mirroring the project's existing migration conventions (reversible where reasonably possible).

### 2. Domain entity, repository, use case updates
- `Exercise` entity (`backend/src/modules/exercises/domain/entities/exercise.py`): replace `category` param/attribute with `muscle_group`; add `equipment` and `video_url` (both `str | None = None`).
- `ExerciseModel` (`exercise_model.py`): rename `category` column to `muscle_group`; add `equipment`, `video_url` columns matching the migration.
- `ExerciseRepositoryImpl` (`exercise_repository_impl.py`): update `create()` and `_model_to_entity()` to map the renamed/new fields.
- `CreateExercise` use case (`create_exercise.py`): update signature — `muscle_group: str | None = None`, `equipment: str | None = None`, `video_url: str | None = None` — replacing the old `category` param. Keep the existing duplicate-name check unchanged.

### 3. YouTube-only validation for `video_url`
- Add server-side validation (Pydantic validator on `CreateExerciseRequest` in `backend/src/modules/exercises/presentation/schemas.py`) that rejects any non-empty `video_url` that isn't a real YouTube URL. Accept `https://www.youtube.com/watch?v=...`, `https://youtube.com/watch?v=...`, `https://youtu.be/...`, and the `www.`-less/`m.`-prefixed variants; reject everything else (including other video hosts, plain domains, or malformed strings) with a clear validation error message (e.g. "Please provide a valid YouTube link").
- This is a server-side safety net — the frontend task will add its own client-side check too, but the backend must not trust it.

### 4. New endpoint: distinct equipment options
- Mirror `GetMuscleGroups` exactly: add `get_distinct_equipment(self) -> list[str]` to `ExerciseLibraryRepository` (interface + impl, same pattern as `get_distinct_muscle_groups`, filtering out NULLs), a `GetEquipmentOptions` use case, and `GET /api/exercise-library/equipment` returning `{"equipment_options": [...]}` (or whatever shape keeps `MuscleGroupsResponse`'s existing shape convention — match its naming style).
- This lets the frontend task populate an equipment dropdown from real seeded data, the same way muscle groups already work.

### 5. Update `exercises` routes and schemas end-to-end
- `CreateExerciseRequest` / `ExerciseResponse` (`exercises/presentation/schemas.py`): replace `category` with `muscle_group: str | None`, add `equipment: str | None`, `video_url: str | None`.
- `routes.py` (`exercises` module): pass the new fields through `create_exercise` and echo them in `list_exercises` responses.
- `exercisesApi.ts` on the frontend is explicitly **out of scope for this task** (backend only) but note the exact new request/response shape in your summary so the frontend task can match it precisely.

## Do NOT
- Do not touch the `exercise_library` module's own `muscle_group`/`equipment` columns or seed data — this task only changes the per-user `exercises` table.
- Do not add any frontend form, dropdown, or UI changes — that's Task 45/46/47.
- Do not remove or change `logging_type` or `name` handling.
- Do not make `muscle_group`/`equipment`/`video_url` required — all three stay optional (nullable), matching how the shared library treats `equipment`/`video_url` as optional too.

## Acceptance criteria
- [ ] Migration runs cleanly (`alembic upgrade head`) against a fresh DB and against the existing dev DB (no data loss — confirm any existing `category` values, expected to be NULL, survive as `muscle_group` NULL).
- [ ] `POST /api/exercises` accepts `muscle_group`, `equipment`, `video_url` and persists them; omitting all three still works exactly as today.
- [ ] `POST /api/exercises` with a non-YouTube `video_url` (e.g. `https://vimeo.com/123`, `https://example.com`, `not-a-url`) is rejected with a clear 422 validation error.
- [ ] `POST /api/exercises` with a real YouTube URL in any of the accepted shapes succeeds.
- [ ] `GET /api/exercises` echoes back `muscle_group`, `equipment`, `video_url` for each exercise.
- [ ] `GET /api/exercise-library/equipment` returns the sorted distinct equipment values from the seeded library (14-16 values expected against the current seed data).
- [ ] Existing backend tests for the `exercises` module still pass; add/update unit tests for `CreateExercise` covering the new fields and the YouTube validation (valid + invalid cases).

## Review checklist
- [ ] Confirm the migration is a genuine rename (not silently a drop+recreate that would lose data in an environment where `category` isn't NULL).
- [ ] Spot-check the YouTube validator against a handful of real-world YouTube URL shapes (shortened, with extra query params like `&t=30s`, mobile `m.youtube.com`) to make sure it isn't overly strict.
- [ ] Confirm no other module/migration referenced the old `category` column name (repo-wide grep) before considering the rename complete.
