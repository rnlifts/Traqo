# Task 45 — Frontend: Custom Exercise creation form

## Objective
Build the form component users fill out to create a custom exercise with muscle group, equipment, and an optional YouTube link — the piece that Tasks 46 and 47 will each hook into. This task is just the form + API plumbing, rendered and testable on its own; it does not need to be wired into the sidebar yet.

## Context
- Depends on Task 44 (backend) being complete first: `POST /api/exercises` now accepts `muscle_group`, `equipment`, `video_url`; `GET /api/exercise-library/muscle-groups` and the new `GET /api/exercise-library/equipment` return the real vocab options.
- Today, "creating" a custom exercise is just `exercisesApi.create(name)` — a bare name, no metadata (`PlanBuilder.tsx:388`, `ActiveWorkout.tsx:501`). This task replaces that bare call with a real form for the *creation* moment; Tasks 46/47 decide *where* the form is triggered from.
- `frontend/src/api/exercisesApi.ts` needs its `CreateExerciseRequest` interface and `create()` signature updated to match Task 44's new request/response shape (`muscle_group`, `equipment`, `video_url` — check the actual field names Task 44 shipped with, since exact naming matters for the request body to be accepted).
- `frontend/src/api/exerciseLibraryApi.ts` already has `getMuscleGroups()` — reuse it for the muscle group dropdown's options. Add a matching `getEquipmentOptions()` call against the new endpoint for the equipment dropdown.

## Requirements

### 1. Update `exercisesApi.ts`
- Update `CreateExerciseRequest` and the `create()` method to send `muscle_group`, `equipment`, `video_url` (all optional) alongside `name`.
- Update the `Exercise` interface to include the same three fields in responses.
- Add `getEquipmentOptions(): Promise<string[]>` calling the new `GET /api/exercise-library/equipment` endpoint (mirror how `getMuscleGroups()` is already implemented in `exerciseLibraryApi.ts`).

### 2. Build a `CustomExerciseForm` component
New component, e.g. `frontend/src/features/exerciseLibrary/CustomExerciseForm.tsx`:
- Fields: **Name** (required, text input), **Muscle group** (dropdown populated from `exerciseLibraryApi.getMuscleGroups()`, optional — allow a "none selected" state since this is a custom exercise and the user may not know/care), **Equipment** (dropdown populated from `exercisesApi.getEquipmentOptions()`, same optional treatment), **YouTube link** (optional text input).
- Accept an optional `initialName?: string` prop so callers (Task 47's "Create New" flow) can pre-fill the name from a search query the user already typed.
- Client-side YouTube validation: as the user types/blurs the link field, show an inline error if the value is non-empty and doesn't look like a real YouTube URL (accept the same shapes as the backend validator from Task 44 — `youtube.com/watch?v=`, `youtu.be/`, `m.youtube.com`, with or without `www.`). Keep the submit button disabled while this field has an invalid (non-empty, non-YouTube) value — same disabled-until-valid pattern already used elsewhere in this app (e.g. Register's username-taken state).
- On submit, call `exercisesApi.create(...)` with all four fields. On success, call an `onCreated: (exercise: Exercise) => void` prop so the caller decides what happens next (add it to the current plan day, refresh a list, close a modal, etc.) — this component should not know or care where it's being used.
- On failure (e.g. duplicate name, or a validation error that slipped past the client check), show the real error message from the API, not a generic one.

### 3. Don't wire it in yet
- This task only needs to produce the component itself, correctly calling the API and handling both fields, in a state where it *could* be rendered (e.g. temporarily mount it somewhere trivial to manually verify it works, then leave that out of the final diff, or leave it behind an easy-to-find but currently-unused import) — Tasks 46 and 47 are responsible for actually placing it in the UI.

## Do NOT
- Do not touch `ExerciseLibrarySidebar.tsx`'s layout or the existing "Create New" button — that's Task 47.
- Do not add a "Custom Exercise" section to the sidebar — that's Task 46.
- Do not make muscle group or equipment required fields — the system doesn't have any existing feature that requires these to be set, so both must stay optional.
- Do not change how the shared exercise *library* search/results work — this is only about the user's own custom exercises.

## Acceptance criteria
- [ ] Form renders name/muscle-group/equipment/YouTube-link fields, with muscle group and equipment populated from the real backend endpoints (verify against a running backend, not mocked-only).
- [ ] Submitting with just a name succeeds (all metadata optional).
- [ ] Submitting with an invalid YouTube link (e.g. a Vimeo URL, a bare domain, random text) is blocked client-side with a visible, specific error before the request is ever sent.
- [ ] Submitting with a valid YouTube link in each accepted shape succeeds.
- [ ] `onCreated` fires with the real created `Exercise` (including its new `id`) after a successful submit.
- [ ] No TypeScript errors; existing `exercisesApi`/`exerciseLibraryApi` consumers elsewhere in the app still compile against the updated interfaces.

## Review checklist
- [ ] Confirm the client-side YouTube check and the backend's (Task 44) accept/reject the same set of URL shapes — a link that passes one but fails the other is a real bug, not just a nitpick.
- [ ] Confirm the form doesn't silently swallow a duplicate-name error — the user should see why creation failed.
