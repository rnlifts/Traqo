# Task 51 — Frontend: Custom Exercise create/edit form

## Objective
One shared form component for both creating a new custom exercise and editing an existing one. Depends on Tasks 49 and 50 (backend fields + update endpoint must exist first).

## Context
- `frontend/src/api/exercisesApi.ts` currently has `create()`, `list()`, `delete()`. Needs updating for the new fields (Task 49's shape: `muscle_group`, `equipment`, `video_url`) and a new `update()` method calling `PUT /api/exercises/{id}` (Task 50).
- `frontend/src/api/exerciseLibraryApi.ts` already has `getMuscleGroups()` — reuse for the muscle-group dropdown. Add a matching `getEquipmentOptions()` for the equipment dropdown, calling `GET /api/exercise-library/equipment` (Task 49).
- Real muscle-group vocabulary (from `getMuscleGroups()`): lowercase values like `chest`, `back`, `biceps`, `quads` — not a hardcoded list.
- Owner has explicitly confirmed the form only needs the real schema fields: name, muscle group, equipment, YouTube link. Nothing else (no "instructions", "difficulty", etc. — those were noise from an AI paraphrasing tool, not a real request).

## Requirements
1. Update `exercisesApi.ts`: `Exercise` interface gets `muscle_group`, `equipment`, `video_url` (replacing `category`). `create()` and new `update(id, request)` both accept an object with `name`, `muscle_group?`, `equipment?`, `video_url?`. Add `getEquipmentOptions()` to `exerciseLibraryApi.ts` (not `exercisesApi.ts` — it's an exercise-library endpoint, keep API modules organized by the resource they actually call).
2. Build `CustomExerciseForm` component (`frontend/src/features/exerciseLibrary/CustomExerciseForm.tsx`):
   - Props: `mode: 'create' | 'edit'`, `initialValues?: { id?, name, muscle_group, equipment, video_url }` (for edit, or a pre-filled name for the create-from-search-miss flow — see Task 53), `onSaved: (exercise: Exercise) => void`, `onCancel: () => void`.
   - Fields: Name (required), Muscle group (dropdown from `getMuscleGroups()`, includes an explicit empty/"none selected" option — never forced to a value), Equipment (dropdown from `getEquipmentOptions()`, same treatment), YouTube link (optional text input).
   - Client-side YouTube validation: same substring-based check as the backend (`youtube.com/watch`, `youtu.be/`) — reject anything else with a visible inline error, disable submit while it's invalid and non-empty.
   - Submit calls `exercisesApi.create()` in create mode or `exercisesApi.update()` in edit mode, then calls `onSaved(exercise)`.
   - Real API errors (duplicate name, unauthorized, etc.) must be shown to the user, not swallowed.

## Do NOT
- Do not wire this component into the sidebar yet — that's Task 52/53.
- Do not add any field beyond name/muscle_group/equipment/video_url.
- Do not build two separate components for create vs edit — one component, a `mode` prop.

## Acceptance criteria
- [ ] Same form works for both creating and editing, verified against the real running backend (not mocked-only).
- [ ] Muscle group and equipment dropdowns are populated from the real endpoints and both allow staying unset.
- [ ] Invalid YouTube link blocked client-side with a visible error before any request is sent; valid link (any of `youtube.com/watch?v=...`, `youtu.be/...`) succeeds.
- [ ] Edit mode pre-fills all existing values correctly and calls `update()`, not `create()`.
- [ ] No TypeScript errors anywhere in the app after the `exercisesApi`/`exerciseLibraryApi` interface changes (check every existing call site still compiles).
- [ ] **Run the full frontend test suite (`npm test`), not just a type-check** — confirm no regressions, especially anywhere `exercisesApi` is used or mocked.

## Review checklist
- [ ] Confirm the client-side and backend YouTube validators accept/reject the exact same set of URLs.
- [ ] Confirm every existing caller of `exercisesApi.create()` (there are at least two: `PlanBuilder.tsx`, `ActiveWorkout.tsx`) still compiles against whatever shape you give `create()`.
