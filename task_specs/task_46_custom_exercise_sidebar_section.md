# Task 46 — Frontend: "Custom Exercise" section in the plan builder sidebar

## Objective
Add a distinct "Custom Exercise" section to the plan builder's sidebar, next to the existing "Exercise Library" section, where users can browse/reuse their own previously-created custom exercises and create new ones via Task 45's form. Every exercise created through that form must show up here.

## Context
- Depends on Task 45 (the `CustomExerciseForm` component and updated `exercisesApi`) being complete.
- The sidebar today is `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx`, rendered inside `PlanBuilder.tsx` (`<ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} />`, around `PlanBuilder.tsx:1324`). It has one heading, "Exercise Library" (`ExerciseLibrarySidebar.tsx:95-97`), a search box, muscle-group filter chips, and a scrollable results list from the *shared* library — none of this shows the user's own custom exercises (from the `exercises` table) at all today.
- `exercisesApi.list()` already exists and returns the current user's own exercises (`frontend/src/api/exercisesApi.ts`) — this is the data source for the new section.
- Each library result row already has a "+ Add" button calling `handleSelectExercise(exercise.name)` → `props.onSelectExercise(name)` (`ExerciseLibrarySidebar.tsx:247-262`) → in `PlanBuilder.tsx`, that's `handleQuickAddExercise`, which calls `addExerciseToCurrentDay(name, ...)`. The new Custom Exercise section's "+ Add" buttons should call the same `onSelectExercise` prop so adding a custom exercise to the current plan day works identically to adding a library one.

## Requirements

### 1. Add a "Custom Exercise" section to the sidebar
- In `ExerciseLibrarySidebar.tsx` (or split into a sibling component if that keeps the file more manageable — your call, but it must render in the same sidebar area, visually separated from "Exercise Library" with its own heading, e.g. "Custom Exercise").
- On mount (and after a new custom exercise is created), fetch `exercisesApi.list()` and render each one with the same visual treatment as a library result row (name, muscle group/equipment if set, a "+ Add" button that calls `onSelectExercise(exercise.name)`).
- If the user has no custom exercises yet, show a short empty-state message (e.g. "You haven't created any custom exercises yet.") rather than an empty gap.

### 2. Wire in the create flow
- Add a clearly-visible "+ Create Custom Exercise" entry point within this new section that opens Task 45's `CustomExerciseForm` (inline expand within the section, or a small modal/panel — pick whichever fits this app's existing patterns better, e.g. compare to how `ActiveWorkout.tsx`'s mid-workout "+ Add Exercise" form expands inline at `ActiveWorkout.tsx:1313-1361` — that inline-expand pattern is probably the better fit here for consistency, but use your judgment).
- On the form's `onCreated` callback: (a) close/collapse the form, (b) immediately show the new exercise in the Custom Exercise list without requiring a manual refresh (re-fetch `exercisesApi.list()` or optimistically prepend the returned exercise), and (c) do **not** auto-add it to the current plan day — creating and adding are separate actions; the user clicks "+ Add" on it afterward like any other custom exercise, same as they would for a library result.

### 3. Keep it visually distinct from the shared library
- The two sections (Exercise Library vs Custom Exercise) must be clearly separated — different heading, enough visual space/border between them — so a user immediately understands these are two different sources (a shared catalog vs. their own personal list), not one merged list.

## Do NOT
- Do not change how the shared "Exercise Library" section's search/filter/results work.
- Do not auto-add a newly created custom exercise to the current day — that's a separate, explicit "+ Add" click.
- Do not require muscle group/equipment to display an exercise in this list — many will have neither set (they're optional per Task 44/45).
- Do not touch the "Create New: {query}" prompt inside the Exercise Library section's search flow — that's Task 47.

## Acceptance criteria
- [ ] A "Custom Exercise" section is visible in the sidebar, separate from "Exercise Library", listing the current user's own exercises.
- [ ] Creating a new custom exercise via the form immediately makes it appear in this list (verified without a page refresh).
- [ ] Clicking "+ Add" on a custom exercise adds it to the current plan day exactly like a library "+ Add" does (same toast, same resulting exercise row).
- [ ] A brand-new user with zero custom exercises sees a clear empty state, not a blank/broken-looking section.
- [ ] No regression to the existing Exercise Library search/filter behavior.

## Review checklist
- [ ] Confirm the new section doesn't make an extra `exercisesApi.list()` call on every keystroke or re-render — fetch on mount and after creation only.
- [ ] Confirm this section's own scroll/layout doesn't break the existing library section's scrolling within the same sidebar panel.
