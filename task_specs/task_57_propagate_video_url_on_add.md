# Task 57 — Frontend: stop discarding video_url when adding an exercise from the library

## Objective
Fix the actual root cause of "exercises added from the library have no thumbnail/video": `ExerciseLibrarySidebar.tsx`'s "+ Add" button only ever passes the exercise's bare **name** up to `PlanBuilder.tsx`, even though the sidebar already has the exercise's `video_url`/`muscle_group`/`equipment` in hand from the search result. When that name isn't yet a personal exercise, `PlanBuilder` creates a brand-new one with nothing but a name — permanently losing the metadata. Depends on Task 56 (backend must expose `video_url` on the library search response first).

## Context
- `ExerciseLibrarySidebar.tsx`'s `onSelectExercise` prop is currently typed `(name: string) => void`. `handleSelectExercise(name)` calls it, and it's invoked from two places: the Exercise Library tab's "+ Add" button (~line 461, using a `LibraryExercise` object) and the Custom Exercises tab's "+ Add" button (~line 601, using an `Exercise` object — which already has `video_url` on it, e.g. from `CustomExerciseForm`).
- `PlanBuilder.tsx`'s `handleQuickAddExercise(name)` (line 453) is the prop passed as `onSelectExercise`. It calls `addExerciseToCurrentDay`, which does a name-based lookup against `availableExercises`; if not found, it calls `exercisesApi.create({ name })` — no metadata passed, matching Task 54's `is_custom: false` marking but nothing else.
- **This task is specifically about `PlanBuilder.tsx` + `ExerciseLibrarySidebar.tsx`.** `ActiveWorkout.tsx`'s own "+ Add Exercise" flow (`handleAddExerciseToDay`) is a separate, simpler mid-workout text-input form with no library browsing UI at all — there's no richer metadata available there to lose in the first place, so it's out of scope here (see Do NOT).

## Requirements

### 1. Widen what gets passed when an exercise is selected
- Change `ExerciseLibrarySidebar`'s `onSelectExercise` prop type from `(name: string) => void` to accept an object carrying at least `{ name: string, video_url?: string | null, muscle_group?: string | null, equipment?: string | null }` — pick a clear type name (e.g. `SelectedExerciseInfo`) and define it once, reused by both the `LibraryExercise` and `Exercise` (custom) sources.
- Update `handleSelectExercise` and its two call sites (the Library tab's "+ Add", the Custom Exercises tab's "+ Add") to pass through the real `video_url`/`muscle_group`/`equipment` from whichever object was clicked, not just `.name`.

### 2. Use the richer payload when creating a new personal exercise stub
- In `PlanBuilder.tsx`, update `handleQuickAddExercise` and `addExerciseToCurrentDay` to accept the richer payload (not just a name string).
- When the name-based lookup doesn't find an existing personal exercise (the "first time this library item is used" branch), pass `video_url`, `muscle_group`, and `equipment` through to `exercisesApi.create(...)` alongside `name` and `is_custom: false` (already there from Task 54) — so the newly-created personal exercise stub is no longer metadata-less.
- When the name-based lookup *does* find an existing personal exercise (already used before), keep using that existing record as-is — do not overwrite its fields from the freshly-clicked library item (it might have been edited since).

## Do NOT
- Do not change `ActiveWorkout.tsx`'s `handleAddExerciseToDay` — it has no library-search UI to source richer data from; this task doesn't apply to it.
- Do not change the Custom Exercises tab's own create/edit flow (`CustomExerciseForm.tsx`) — it already stores real metadata correctly; this task is only about what happens when *adding* an already-existing exercise (library or custom) to a plan.
- Do not add a UI for editing metadata at add-time — this is a silent, automatic carry-through, not a new form.

## Acceptance criteria
- [ ] Adding a library exercise (one never added to a plan before, by this user) to a plan day results in a personal exercise record that has the real `video_url`/`muscle_group`/`equipment` copied over — verified by checking the actual database row after adding, not just the UI.
- [ ] Adding a custom exercise to a plan still works exactly as before (already has its own metadata, nothing to fix there, just confirm no regression).
- [ ] Adding an exercise that's already been added before (existing personal record found via name lookup) does not overwrite that record's fields.
- [ ] No regression to the 409-duplicate-create fix from earlier — this task changes what data flows into `exercisesApi.create()`, not the find-or-create logic itself.
- [ ] Full frontend test suite passes; update any tests that assert on the old `onSelectExercise: (name: string) => void` signature.

## Review checklist
- [ ] Confirm by direct DB query (not just UI glance) that a freshly-added library exercise's personal record has a real `video_url`, not null.
- [ ] Confirm existing personal exercises aren't silently overwritten when re-added.
