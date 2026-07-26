# Task 18 — Add `target_duration_seconds` to per-set overrides (migration + backend + types)

## Objective
Per-set overrides ("Vary by set") currently can only store reps and weight — there's no column for duration at all, so duration-based exercises (e.g. cardio with a target duration) can never get per-set duration overrides. Add the missing column end-to-end: migration, domain entity, repository, API schemas/routes, and TypeScript types. **This task is backend + types only — no UI changes.** The UI that actually uses this (making "Vary by set" show the right field per exercise) is Task 19, which depends on this.

## Context
- Table `workout_exercise_set_targets` (added in `backend/migrations/versions/add_set_target_flags_001.py`) has only `target_reps` (String(20)) and `target_weight` (Float) — confirmed via `backend/src/modules/workouts/infrastructure/models/workout_exercise_set_target_model.py`. No duration column exists.
- Compare to the parent `workout_exercises` table, which already has `target_duration_seconds` (Integer, nullable) — this task brings the per-set table to parity with that.
- **Alembic caveats for this project** (both burned us before, follow exactly):
  - Run migrations from `backend/migrations` with `DATABASE_URL` and `PYTHONPATH` (pointing at `backend`) set as env vars — running `alembic` from another directory or without these env vars fails.
  - Revision ids must be ≤32 characters (`alembic_version.version_num` is `VARCHAR(32)`).
- Current migration head is `add_set_target_flags_001` (nothing else has it as `down_revision` — confirmed by checking all migration files). Your new migration's `down_revision` must be `'add_set_target_flags_001'`.

## Requirements

### 1. Migration
Create `backend/migrations/versions/add_set_target_duration_001.py` (28 chars, fits the 32-char limit):
```python
"""Add target_duration_seconds to workout_exercise_set_targets.

Revision ID: add_set_target_duration_001
Revises: add_set_target_flags_001
Create Date: <today's date>

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_set_target_duration_001'
down_revision = 'add_set_target_flags_001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('workout_exercise_set_targets', sa.Column('target_duration_seconds', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('workout_exercise_set_targets', 'target_duration_seconds')
```
Apply it (from `backend/migrations`, with `DATABASE_URL`/`PYTHONPATH` set) and confirm `alembic current` shows the new revision as head.

### 2. Domain entity
`backend/src/modules/workouts/domain/entities/workout_exercise_set_target.py` — add `target_duration_seconds: int | None = None` to `__init__` and store it as `self.target_duration_seconds`.

### 3. Model
`backend/src/modules/workouts/infrastructure/models/workout_exercise_set_target_model.py` — add `target_duration_seconds = Column(Integer, nullable=True)`, include it in `to_domain()`.

### 4. Repository
`backend/src/modules/workouts/infrastructure/repositories/workout_exercise_set_target_repository_impl.py` — thread `target_duration_seconds` through everywhere `target_reps`/`target_weight` currently appear: `add()`, `update()`, and `replace_all_for_exercise()` (both the `WorkoutExerciseSetTargetModel(...)` construction and nothing else needs it, since `to_domain()` already picks up all model columns once step 3 is done).

### 5. Schemas
`backend/src/modules/workouts/presentation/schemas.py`:
- `SetTargetResponse`: add `target_duration_seconds: int | None`.
- `SetTargetRequest`: add `target_duration_seconds: int | None = Field(None, gt=0)` (matches the validation style already used for `target_duration_seconds` on `AddExerciseRequest`/`UpdateExerciseInDayRequest`).

### 6. Routes
`backend/src/modules/workouts/presentation/routes.py`:
- `_build_workout_exercise_response()` (~line 109): when constructing `SetTargetResponse` from each `st` (~line 126-130), add `target_duration_seconds=st.target_duration_seconds`.
- `update_exercise_set_targets()` (~line 827): when constructing `WorkoutExerciseSetTarget` from each request item `st` (~line 879-886), add `target_duration_seconds=st.target_duration_seconds`.

### 7. Frontend types
`frontend/src/api/workoutPlansApi.ts`:
- `WorkoutExercise.set_targets` (line 26): extend the inline type to `{ set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }[]`.
- `workoutPlansApi.replaceSetTargets()` (line 208-218): extend the `targets` parameter type the same way.

## Do NOT
- Do not touch the frontend UI in this task (Plan Builder's "Vary by set" panel, ActiveWorkout) — that's Task 19. This task only makes the data round-trippable; nothing reads/writes `target_duration_seconds` on a set target from the UI yet, and that's expected/fine for this task.
- Do not change `workout_exercises.target_duration_seconds` (the main row's field) — already exists, not in scope.
- Do not add validation coupling duration to `has_duration` at the database layer — consistent with the existing pattern, `has_reps`/`has_weight`/`has_duration` remain UI-only display concerns, never backend-enforced.

## Acceptance criteria
- [ ] Migration applies cleanly (`alembic upgrade head` from `backend/migrations` with correct env vars) and `alembic current` shows `add_set_target_duration_001`.
- [ ] `PUT /workout-plans/{id}/days/{id}/exercises/{id}/set-targets` accepts a payload including `target_duration_seconds`, e.g. `[{"set_number": 1, "target_reps": null, "target_weight": null, "target_duration_seconds": 300}]`, and it round-trips: a subsequent `GET /workout-plans/{id}` shows that same `target_duration_seconds: 300` in `set_targets[0]`.
- [ ] Omitting `target_duration_seconds` from the request (existing reps/weight-only payloads, as sent by today's frontend) still works exactly as before — this is a nullable, additive field, no breaking change to existing callers.
- [ ] Backend restarted (this project runs with `reload=False` — a fresh process is required to pick up code changes) and verified against a live request, not just read from code.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: an actual PUT + GET round trip with `target_duration_seconds` set, confirmed via real HTTP requests (curl/fetch), not just code review.
