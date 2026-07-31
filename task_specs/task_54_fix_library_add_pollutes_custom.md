# Task 54 — Fix: adding a library exercise pollutes the Custom Exercises tab

## Objective
Adding an exercise from the "Exercise Library" tab (a real, shared catalog item) is silently creating a personal exercise record with that same name, which then shows up in the "Custom Exercises" tab — confusing, since the user never created it. Adding from Custom Exercises should keep working exactly as it does. Fix this without changing how plans store/reference exercises (that would be a much bigger, riskier change — see Context).

## Context — read carefully, this explains why the bug happens and why the fix is scoped the way it is
- `workout_exercises.exercise_id` is a foreign key into the per-user `exercises` table ONLY. There is currently no way for a plan-exercise row to reference a shared `exercise_library_items` row directly — that would require a schema change to `workout_exercises` (e.g. a nullable `library_item_id` column) and touch exercise-progress tracking, PR detection, and workout history, which are all keyed off `exercises.id`. **That refactor is explicitly out of scope for this task** — too large and risky to do as a bug fix.
- Given that constraint, some personal `exercises` row will always need to exist for any exercise that's ever added to a plan, library-sourced or not. The actual bug is narrower: **the Custom Exercises tab shows ALL of the user's exercises, with no way to distinguish "the user genuinely typed this in as their own" from "this was auto-created as a side effect of picking a library item."**
- Reproduced live: clicking "+ Add" on "Barbell Hip Thrust" (a real library item) in the Exercise Library tab immediately made "Barbell Hip Thrust" appear in the Custom Exercises tab too, with no muscle_group/equipment/video_url (all null) — because `addExerciseToCurrentDay` (`PlanBuilder.tsx`) and its equivalent in `ActiveWorkout.tsx` do a name-based lookup against the user's own exercises; if not found, they silently call `exercisesApi.create({ name })`, which has no way today to say "this one's not really custom."
- This is not new behavior from last night's work — it's how "add exercise to a plan" has always worked. The Custom Exercises tab (built last night) is just the first UI that ever surfaced it. The owner's account already has real, historical clutter from this (e.g. "Flat Dumbbell Bench Press", "Alternating Dumbbell Curl", "Pec Deck Flye", "Assisted Dip" all sitting in their personal exercises table with null metadata, exact-matching real library item names) — this task must also clean that up, not just prevent new pollution.
- Confirmed safe to distinguish by exact-name-match: none of the genuinely custom exercise names already in use ("bench press", "pull up", "hello") collide with any real library item name.

## Requirements

### 1. Migration: add `is_custom` to `exercises`
- New Alembic migration. Add `is_custom` (`Boolean`, `NOT NULL`, `server_default=true`) to `exercises`. Check the current head (`add_exercise_metadata_001`) before writing `down_revision` — don't assume, verify live with `alembic heads`. Keep the revision id ≤32 characters (same lesson as before).
- **Data backfill in the same migration**: for every existing `exercises` row whose `name` case-insensitively exact-matches a real `exercise_library_items.name` AND has `muscle_group IS NULL AND equipment IS NULL AND video_url IS NULL`, set `is_custom = false`. This retroactively cleans up the existing pollution without deleting any data — those rows still exist (plans referencing them keep working), they just stop showing in the Custom Exercises tab. Write this as a real SQL `UPDATE ... FROM` (or equivalent ORM-free raw SQL in the migration) joining on lowercased name equality between the two tables.
- Reversible `downgrade()` (drop the column; the backfill itself doesn't need to be undone since it's just a boolean flag on data that still exists).
- Verify by actually running `alembic upgrade head` and `alembic downgrade -1` against a real Postgres database, and spot-check the backfill: query `exercises` for a couple of known-polluted names before/after and confirm `is_custom` flips correctly.

### 2. Backend: mark exercises correctly at creation time
- `Exercise` entity, `ExerciseModel`, repository create/list/`_model_to_entity` mappings: add `is_custom: bool = True`.
- `CreateExerciseRequest`/`ExerciseResponse` schemas: add `is_custom: bool = True` (request), `is_custom: bool` (response, always echoed).
- `CreateExercise` use case: accept `is_custom: bool = True` and pass it through to the entity.
- `POST /api/exercises` route: accept and pass through `is_custom` from the request (defaults true, so all *existing* frontend callers that don't send it keep working exactly as before — this must not be a breaking change for the CustomExerciseForm's real create flow, or Task 53's "create from failed search" flow, both of which should keep `is_custom=true`, the default).
- `GET /api/exercises`: add an optional query param `custom_only: bool = False`. When true, `ListExercises` (or the route directly) filters to `is_custom = True` only. Add a `list_by_user_custom_only(user_id)` or equivalent method to `ExerciseRepository` (interface + impl) — or add a `custom_only` param to the existing `list_by_user` method, your call, but keep it consistent with this project's existing patterns. **Same lesson as every prior task: if you touch `ExerciseRepository`'s interface, `InMemoryExerciseRepository` in `backend/tests/conftest.py` needs the same change in the same commit, or every test using that fixture breaks.**

### 3. Frontend: mark exercises correctly when quick-adding from the library
- `PlanBuilder.tsx`'s `addExerciseToCurrentDay` and `ActiveWorkout.tsx`'s equivalent (`handleAddExerciseToDay`): when the name-based lookup fails to find an existing personal exercise and falls back to `exercisesApi.create({ name })`, this is exactly the "picked from shared library, name not yet personal" case — pass `is_custom: false` explicitly.
- `exercisesApi.ts`: add `is_custom` to the `Exercise` and `CreateExerciseRequest` interfaces. Add a way to fetch only custom exercises — either a `listCustom()` method calling `GET /api/exercises?custom_only=true`, or a parameter on the existing `list()` — match whatever the backend route ends up using.
- `CustomExerciseForm.tsx`'s real create flow, and Task 53's "create new from failed search" flow (`handleCreateCustomExerciseFromSearch` in `ExerciseLibrarySidebar.tsx`) must both keep creating genuinely custom exercises — they should NOT pass `is_custom: false`. Leave them using the default (`true`) or pass it explicitly for clarity, your call, but verify these two flows still mark their exercises as custom.
- `ExerciseLibrarySidebar.tsx`'s `loadCustomExercises()` (used by the Custom Exercises tab): switch from the plain `list()` call to the custom-only variant, so the tab only shows genuinely custom exercises.

## Do NOT
- Do not change how `workout_exercises.exercise_id` works or add any new FK relationship to `exercise_library_items` — that's the explicitly out-of-scope bigger refactor described in Context.
- Do not delete any existing exercise rows — the backfill only flips a boolean flag, never removes data.
- Do not change the "+ Add" behavior itself (adding to the current plan day) — only which exercises get flagged as custom vs. library-derived, and which ones the Custom Exercises tab displays.
- Do not touch the Delete button's existing "blocked if in use" behavior.

## Acceptance criteria
- [ ] Migration runs both directions against a real Postgres database, confirmed live (not just syntax-checked).
- [ ] Backfill correctly flips `is_custom = false` only for rows that are exact-name matches to real library items with all-null metadata — spot-checked against real data (e.g. confirm "Barbell Hip Thrust", "Flat Dumbbell Bench Press" flip to `false`; confirm "bench press", "pull up", "hello", "inchworm" stay `true`).
- [ ] Adding a fresh library exercise to a plan (one never added before) does NOT make it appear in the Custom Exercises tab — verified live by reproducing the exact repro steps (add a not-yet-used library exercise, switch to Custom Exercises tab, confirm it's absent).
- [ ] Creating a genuine custom exercise (via "+ Add Custom Exercise" or via the repositioned "Create New" search-miss flow) still appears in the Custom Exercises tab exactly as before.
- [ ] Adding a custom exercise to a plan (from the Custom Exercises tab) still works with no 409, exactly as the existing behavior.
- [ ] Full backend AND frontend test suites pass — this touches `ExerciseRepository`'s interface, so watch for the conftest.py test-double lesson.

## Review checklist
- [ ] Confirm the backfill migration was tested against data that actually looks like the real pollution (name matches library, null metadata) — not just an empty table.
- [ ] Confirm the two "this should stay custom" flows (CustomExerciseForm's real create, and Task 53's create-from-search-miss) were explicitly tested live, not just assumed to be unaffected by the default.
- [ ] Confirm `InMemoryExerciseRepository` in conftest.py got whatever interface change was made.
