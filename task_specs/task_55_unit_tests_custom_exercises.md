# Task 55 — Unit tests for the Custom Exercises feature (Tasks 49-54 + follow-ups)

## Objective
Add real unit test coverage for the Custom Exercises tab feature built across last night's Tasks 49-54 plus two follow-up changes (free-text muscle group/equipment fields, YouTube thumbnail extraction). Most of the backend already has decent coverage; the biggest real gap is on the frontend, where `CustomExerciseForm.tsx` has **zero** dedicated tests despite being a core piece of this feature.

## Context — what already exists, so you don't duplicate work
- `backend/tests/unit/test_exercises.py` already has solid coverage for `CreateExercise`, `ListExercises`, `DeleteExercise`, `UpdateExercise`, and YouTube URL validation (`TestYoutubeUrlValidation`, 10 tests). Don't re-test what's already covered there — read the file first.
- `backend/tests/unit/test_exercise_library.py` already has `TestGetEquipmentOptions` (3 tests). Don't duplicate.
- Frontend: `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.test.tsx` exists with 7 tests, but they predate most of this feature (tabs, Custom Exercises tab, Edit/Delete, thumbnail extraction) — they were only patched enough to keep passing as the feature grew, not written to cover the new behavior.
- `frontend/src/features/exerciseLibrary/CustomExerciseForm.tsx` has **no test file at all**. This is the single biggest gap — it's the form used for both creating and editing custom exercises, with client-side YouTube validation, free-text muscle group/equipment fields (as of today — no longer dropdowns), and dual create/edit modes.
- Real confirmed gap on the backend: the `is_custom` flag (Task 54) has no dedicated unit test coverage anywhere — not on `CreateExercise` (does it default to `true`? does passing `is_custom=false` actually get echoed back?), and not on the `custom_only` filtering (`GET /api/exercises?custom_only=true`, which calls `ExerciseRepository.list_by_user_custom_only` — note this is called directly from the route, not wrapped in a use case, so test it either at the repository/in-memory-double level or via a route integration test).

## Requirements

### Backend — `backend/tests/unit/test_exercises.py`
Add tests for what's genuinely uncovered:
1. `CreateExercise` defaults `is_custom` to `True` when not passed.
2. `CreateExercise` respects `is_custom=False` when explicitly passed, and it's present on the returned entity.
3. `UpdateExercise` does not change `is_custom` when updating other fields (it was never designed to touch this flag — confirm that stays true).
4. `list_by_user_custom_only` (via `InMemoryExerciseRepository` or a dedicated fixture) returns only `is_custom=True` rows for a user, excluding both `is_custom=False` rows and other users' rows.

### Backend — integration test (new or extend an existing route test file)
Add a route-level test (find and follow the existing pattern in `backend/tests/integration/` — look for how `test_exercise_library_routes.py` or similar is structured) for:
1. `GET /api/exercises?custom_only=true` returns only `is_custom=True` exercises for the authenticated user.
2. `GET /api/exercises` (no param) still returns everything, unchanged.
3. `PUT /api/exercises/{id}` — at least one happy-path test if the existing integration suite doesn't already cover this route (check first; `UpdateExercise`'s unit tests already exist, but confirm there's a real HTTP-level test too, not just the use case in isolation).

### Frontend — new file `frontend/src/features/exerciseLibrary/CustomExerciseForm.test.tsx`
Mock `exercisesApi` and `exerciseLibraryApi` at the module boundary (`vi.mock(...)`), matching the pattern already used in `ExerciseLibrarySidebar.test.tsx`. Cover:
1. **Create mode**: submitting calls `exercisesApi.create()` with the entered values; `onSaved` fires with the returned exercise.
2. **Edit mode**: form pre-fills from `initialValues`; submitting calls `exercisesApi.update(id, ...)`, not `create()`.
3. **YouTube validation**: entering an invalid URL (e.g. a Vimeo link, plain text) shows a visible inline error and disables submit; entering a valid `youtube.com/watch?v=...` or `youtu.be/...` URL clears the error and allows submit; empty is valid (optional field).
4. **Free-text fields**: muscle group and equipment are plain text inputs now (not `<select>`) — confirm typing an arbitrary value not in the fetched suggestion list is accepted and submitted as-is (this was a same-day change; a stale test asserting `<select>` behavior would be wrong).
5. **Required field**: submit is disabled when name is empty; enabled once a name is entered (with no YouTube error).
6. API error on submit (e.g. duplicate name) is shown to the user, not swallowed.

### Frontend — extend `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.test.tsx`
Add coverage for what's new since the last time this file was meaningfully updated:
1. Tab switching: clicking "Custom Exercises" shows the custom tab's content and hides the library tab's; clicking back works.
2. Custom Exercises tab fetches via the custom-only listing on first switch (not on every switch — check it's not refetching unnecessarily) and renders an empty state when there are none.
3. "+ Add" on a custom exercise calls `onSelectExercise` with its name, same as a library result.
4. Delete: success removes it from the list; a backend error (e.g. simulating `ExerciseInUseError`) is shown to the user, not silently ignored.
5. Edit: opens `CustomExerciseForm` in edit mode with the right `initialValues`.
6. The repositioned "not found" callout: appears directly after the search input (not at the bottom of results) when there's a non-empty query with no exact match; clicking "+ Create New" creates the exercise, switches to the Custom Exercises tab, and opens the form pre-filled — this flow already has one older test ("creates a custom exercise when + Create New button is clicked") — check whether it still accurately reflects the current tab-switch-and-edit-form behavior (built in Task 53) or was written against an older, simpler version of this flow, and correct it if so.
7. Thumbnail extraction: a custom exercise with a valid `video_url` renders an `<img>` with the derived `https://img.youtube.com/vi/{id}/hqdefault.jpg` URL; one without a `video_url` renders the 🏋️ fallback instead.

## Do NOT
- Do not modify any production code (`CustomExerciseForm.tsx`, `ExerciseLibrarySidebar.tsx`, or any backend file) to "make it more testable" — if something is hard to test, use better mocking/setup, not a behavior change. Flag anything that seems to genuinely need a production change instead of guessing.
- Do not duplicate coverage that already exists — read the existing test files first (listed in Context) before adding anything.
- Do not touch E2E tests (`frontend/tests/e2e/`) — this is unit/component test coverage only.
- Do not make any git commits — leave everything uncommitted.
- Do not leave any stray debug/scratch files in the repo when done.

## Acceptance criteria
- [ ] `CustomExerciseForm.test.tsx` exists and covers all 6 points above.
- [ ] `ExerciseLibrarySidebar.test.tsx` covers all 7 points above (existing tests may need updating, not just new ones added — check the "+Create New" test especially).
- [ ] Backend: `is_custom` default/explicit-false/preserved-on-update are covered; `custom_only` filtering is covered at both the repository and route level.
- [ ] Full backend test suite passes (`pytest -q` from `backend/`) — not just the new/changed files.
- [ ] Full frontend test suite passes (`npm test` from `frontend/`), and `npx tsc -b` is clean — these catch different things, run both.
- [ ] Spot-check at least one new test per file by temporarily breaking the underlying behavior and confirming the test actually fails, then restoring it — this is the only way to prove a test has real teeth, not just that it passes.

## Review checklist
- [ ] Confirm no production code was changed.
- [ ] Confirm the "+Create New" test in `ExerciseLibrarySidebar.test.tsx` reflects the actual current flow (tab switch + auto-create + edit form), not a stale assumption from before Task 53.
- [ ] Confirm mocks match the real API shapes (`Exercise`, `CreateExerciseRequest`, `UpdateExerciseRequest` interfaces in `exercisesApi.ts`) exactly — a mock with a wrong shape can pass tests while hiding a real integration bug.
