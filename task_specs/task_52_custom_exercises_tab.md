# Task 52 — Frontend: "Custom Exercises" tab in the sidebar

## Objective
Add a real tab switcher to the plan-builder sidebar — "Exercise Library" | "Custom Exercises" — where the Custom Exercises tab shows the user's own exercises in the exact same card format as the library, with Edit/Delete added. Depends on Tasks 49-51.

## Context — read this before writing any layout code
A previous attempt at a near-identical feature (reverted the same day it was built) added a "Custom Exercise" section **stacked below** the existing scrollable results list in `ExerciseLibrarySidebar.tsx`, with no height/scroll containment of its own. It grew unbounded and squeezed the library results down to a ~38px sliver at realistic window heights (confirmed via direct DOM measurement at 1280×600), which incidentally made muscle-group filtering and thumbnails look completely broken even though they weren't. **This is why the owner specifically wants tabs, not a second stacked section** — a tab replaces the visible content area rather than adding to its height, which structurally cannot cause this failure mode if built correctly (i.e. don't put both tabs' content in the DOM at once inside the same unconstrained flex column — render only the active tab's content in the same content region the current results list already occupies).

- File: `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx`. Current structure: heading "Exercise Library", search input, muscle-group filter chips, a `flex: 1, overflowY: 'auto'` results list, a conditional "Create New" button.
- `exercisesApi.list()` (Task 49-51) returns the user's own exercises.
- Each existing library result row renders: thumbnail/fallback icon, name, muscle group, equipment, a green "+ Add" button calling `onSelectExercise(exercise.name)`.

## Requirements
1. Add a tab bar with two tabs, "Exercise Library" and "Custom Exercises", above the search input (or wherever fits the existing header area). Only one tab's content renders at a time, in the same content region — do not render both simultaneously and hide one with CSS.
2. **"Exercise Library" tab**: exactly the current behavior, unchanged (search, muscle-group filter, results list, existing "Create New" affordance stays here for now — Task 53 repositions/rewires it).
3. **"Custom Exercises" tab**: fetch `exercisesApi.list()` on first switch to this tab (or on mount, your call, but don't refetch on every tab switch after the first). Render each exercise as a card **in the exact same visual layout as an Exercise Library result row** (same thumbnail/icon area — custom exercises have no thumbnail, use the existing fallback icon style already used for "no thumbnail" library items if one exists, or a simple placeholder consistent with the library's — name, muscle group, equipment). Each card gets:
   - The same green "+ Add" button, calling the same `onSelectExercise(exercise.name)` handler as the library.
   - An **Edit** button opening `CustomExerciseForm` (Task 51) in edit mode, pre-filled with this exercise's current values.
   - A **Delete** button calling `exercisesApi.delete(id)`. If the backend rejects it (exercise in use — `ExerciseInUseError`, already-existing behavior, not new), show that error clearly to the user; do not attempt to force it through.
   - Empty state ("You haven't created any custom exercises yet.") when the list is empty.
4. A single **"+ Add Custom Exercise"** button within the Custom Exercises tab (not per-card) opens `CustomExerciseForm` in create mode.
5. After a create or edit succeeds (the form's `onSaved` callback), refresh the Custom Exercises list and close the form. Do not auto-add the exercise to the current plan day — creating/editing and adding are separate actions.
6. **Before calling this done: resize the browser to at least one shorter height (e.g. 1280×600) in addition to a normal one, and confirm the Exercise Library tab's results area is still fully usable and not squeezed** — this is the specific regression this task must not repeat.

## Do NOT
- Do not render both tabs' content in the DOM at once.
- Do not change the Exercise Library tab's search/filter logic.
- Do not auto-add a newly created/edited exercise to the plan.
- Do not build any "create new from failed search" wiring here — that's Task 53, which depends on this tab existing first.

## Acceptance criteria
- [ ] Tab switch shows exactly one tab's content at a time, both tabs reachable.
- [ ] Custom Exercises tab cards are visually identical in layout/styling to Exercise Library cards, plus Edit/Delete.
- [ ] Add/Edit/Delete all work against the real running backend, verified live.
- [ ] Deleting an in-use exercise shows the real backend error, doesn't silently fail or crash.
- [ ] At 1280×600, the Exercise Library tab's results list is still a usable height (not squeezed to a sliver) — checked by actually resizing and measuring, not assumed.
- [ ] **Run the full frontend test suite** — `ExerciseLibrarySidebar.test.tsx` will very likely need updating for the new tab structure; update it, don't leave it broken or leave `exercisesApi` unmocked (an earlier version of this same feature left `exercisesApi.list()` unmocked in this exact test file, causing a real unmocked network call on every test run — mock it from the start this time).

## Review checklist
- [ ] Confirm by direct DOM measurement (not just a glance) that the results-list container's clientHeight stays reasonable at a short viewport with several custom exercises present.
- [ ] Confirm `exercisesApi` is properly mocked in the test file, no real network calls happen when running tests with the backend stopped.
