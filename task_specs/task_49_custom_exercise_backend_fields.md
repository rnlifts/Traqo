# Task 49 — Backend: custom exercise metadata (muscle group, equipment, YouTube link)

## Objective
Add `muscle_group`, `equipment`, `video_url` to the per-user `exercises` table, matching the shared exercise library's schema, plus a distinct-equipment endpoint. This is a redo of a previously-built, previously-reverted task (Task 44) — the design below is already proven correct; this spec exists specifically to prevent repeating three known bugs from last time.

## Context
- `exercises` table (`backend/src/modules/exercises/infrastructure/models/exercise_model.py`) currently has: `id`, `user_id`, `name`, `created_at`, `category` (nullable `String(50)`, dead field — confirmed always NULL in production, no UI ever sets it), `logging_type`.
- Owner has approved repurposing `category` into `muscle_group` (not adding a separate new column) — `category`'s `Literal["Chest","Back",...]` enum in `CreateExerciseRequest` (`backend/src/modules/exercises/presentation/schemas.py`) must be deleted entirely.
- The shared exercise library (`exercise_library_items` table) already has `muscle_group` (real values like `chest`, `back`, `biceps`, `quads` — NOT the old category enum's `Chest`/`Back`/`Legs`) and `equipment` (free text like `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`).
- `exercise_library` already has `GET /api/exercise-library/muscle-groups` (`GetMuscleGroups` use case, `get_distinct_muscle_groups()` on the repository). This task adds the equipment equivalent, following the exact same pattern.
- `exercise_library`'s routes.py has a `derive_youtube_thumbnail(video_url)` helper recognizing `youtube.com/watch` and `youtu.be/` shapes — the YouTube validator below uses this same simple substring-match approach (proven to work, don't over-engineer with real URL parsing).

## Requirements

### 1. Migration
New Alembic migration in `backend/migrations/versions/`.
- Rename `exercises.category` → `exercises.muscle_group` (nullable `String`, genuine `op.alter_column(..., new_column_name=...)`, not drop+recreate).
- Add `equipment` (`String(100)`, nullable) and `video_url` (`String(500)`, nullable).
- Reversible `downgrade()`.
- **KNOWN BUG TO AVOID (hit last time): set `down_revision` to whatever `alembic heads` actually shows as the current head *right before you write this file* — do not assume, check.** Last attempt hardcoded a stale parent, creating two divergent heads and breaking `alembic upgrade head` for everyone.
- **KNOWN BUG TO AVOID (hit last time): the revision id string itself must be ≤32 characters** — `alembic_version.version_num` is `VARCHAR(32)`; a longer id passes `alembic heads`/`alembic upgrade` syntax checks but fails at runtime with `DataError: value too long for type character varying(32)`. Keep it short (e.g. `add_exercise_metadata_001`).
- **Verify by actually running `alembic upgrade head` and `alembic downgrade -1` against a real Postgres database** (not just `alembic heads`) before considering this done.

### 2. Domain, repository, use case
- `Exercise` entity (`domain/entities/exercise.py`): replace `category` with `muscle_group`; add `equipment: str | None = None`, `video_url: str | None = None`.
- `ExerciseModel`: rename column, add the two new columns matching the migration.
- `ExerciseRepositoryImpl`: update `create()` and `_model_to_entity()` mappings.
- `CreateExercise` use case: replace `category` param with `muscle_group`, add `equipment`, `video_url` (all `str | None = None`).

### 3. YouTube-only validation
Pydantic `@field_validator` on `CreateExerciseRequest.video_url` in `presentation/schemas.py`. Accept any URL containing `youtube.com/watch` or `youtu.be/` as a substring (this simple check is proven sufficient — don't build real URL/domain parsing). Reject everything else (Vimeo, generic domains, plain text) with a clear error message. Empty/None must be valid (field is optional).

### 4. Equipment options endpoint
- Add `get_distinct_equipment(self) -> list[str]` to `ExerciseLibraryRepository` (interface + impl), mirroring `get_distinct_muscle_groups()` exactly (filter NULLs, sort).
- New `GetEquipmentOptions` use case (mirror `GetMuscleGroups` exactly).
- New `GET /api/exercise-library/equipment` route returning `EquipmentOptionsResponse(equipment_options: list[str])` — mirror `MuscleGroupsResponse`'s exact shape/naming convention.
- **KNOWN BUG TO AVOID (hit last time): `backend/tests/conftest.py`'s `InMemoryExerciseLibraryItemRepository` test double implements the `ExerciseLibraryRepository` interface — adding `get_distinct_equipment` to the interface means this test double needs the method too, or every test using that fixture breaks with `TypeError: Can't instantiate abstract class`. Add it there in the same change, don't treat it as separate.**

### 5. Routes and schemas end-to-end
- `CreateExerciseRequest`/`ExerciseResponse`: replace `category` with `muscle_group: str | None`, add `equipment: str | None`, `video_url: str | None`.
- `POST /api/exercises` and `GET /api/exercises` routes: pass the new fields through.
- Frontend (`exercisesApi.ts`) is out of scope here — a later task updates it.

## Do NOT
- Do not touch `exercise_library`'s own data/columns — only `exercises`.
- Do not add frontend changes.
- Do not make any of the three new fields required.
- Do not add an `UpdateExercise`/edit endpoint — that's a separate task.

## Acceptance criteria
- [ ] `alembic upgrade head` AND `alembic downgrade -1` both actually run clean against a real Postgres database (not just checked for syntax).
- [ ] `alembic heads` shows exactly one head after this migration.
- [ ] `POST /api/exercises` accepts/persists `muscle_group`, `equipment`, `video_url`; rejects non-YouTube `video_url` with a clear error.
- [ ] `GET /api/exercises` echoes the new fields.
- [ ] `GET /api/exercise-library/equipment` returns sorted distinct equipment values.
- [ ] **Full backend test suite passes (`pytest -q` from `backend/`), not just new/changed test files** — explicitly check `test_exercise_library.py` still passes given the interface change.

## Review checklist
- [ ] Confirm the migration's `down_revision` matches the actual current head (checked live, not assumed).
- [ ] Confirm the revision id is ≤32 characters.
- [ ] Confirm `InMemoryExerciseLibraryItemRepository` in conftest.py has `get_distinct_equipment`.
- [ ] Confirm no other code still references the old `category` field name (repo-wide grep).
