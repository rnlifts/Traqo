# Task 53 — Frontend: reposition "Create New" and wire the auto-create flow

## Objective
Move the "exercise not found" prompt to right below the search bar (highly visible), and make clicking it auto-switch to the Custom Exercises tab, auto-create the exercise with the searched name, and immediately open the edit form pre-filled. Depends on Task 52 (the Custom Exercises tab must exist).

## Context
- Current "Create New" button in `ExerciseLibrarySidebar.tsx` sits at the bottom of the Exercise Library results, only shown when the search has no exact-name match (this visibility condition — exact-match suppression — is correct and must not change, see `task_specs`-style history: Task 38 already fixed a related bug here, don't regress it).
- Owner's reference screenshot shows the target UI: right below the search bar, a highlighted callout — lightbulb icon, "'{query}' not found", "Create a custom exercise to add it to your library", and a prominent blue "+ Create New: '{query}'" button — replacing the old small dashed-border box.
- Owner's confirmed flow: clicking it does NOT just quick-add a bare name. It (a) switches to the Custom Exercises tab, (b) creates a new custom exercise using the searched text as the name (title-cased, e.g. "inch worm" → "Inch Worm"), (c) immediately opens that exercise's edit form (Task 51's `CustomExerciseForm` in edit mode) pre-filled, with only the name required — everything else fillable now or later.

## Requirements
1. Move the "not found" prompt from the bottom of the Exercise Library results to directly below the search input, styled as a visible callout (icon + "not found" message + prominent "+ Create New" button) rather than the current small dashed box. Keep the exact same visibility condition as today: show only when there's a non-empty search query and no exact case-insensitive name match among current results (do not change when it appears, only where/how it looks).
2. Wire its click handler to:
   - Call `exercisesApi.create({ name: titleCase(searchQuery) })` (or whatever casing convention matches the example in Context) — this creates a real exercise via the Task 49/50 backend, not a placeholder.
   - Switch the sidebar's active tab state to "Custom Exercises".
   - Immediately open `CustomExerciseForm` in edit mode for the exercise just created, pre-filled with its current (mostly-empty) values.
   - Refresh the Custom Exercises list so the new exercise is visible in it right away (consistent with Task 52's own create/edit refresh behavior — reuse the same refresh function, don't duplicate it).
3. There should be exactly one `CustomExerciseForm` instance mounted in this sidebar (from Task 52) — this flow opens that same instance, it does not create a second one.

## Do NOT
- Do not change the exact-match suppression condition for when "not found" shows.
- Do not create a second copy of `CustomExerciseForm`.
- Do not skip the auto-create step and just open a blank form — the exercise must actually exist (via the API) the moment the form opens, matching the owner's stated flow.

## Acceptance criteria
- [ ] Searching something not in the library shows the repositioned, prominent callout immediately below the search bar.
- [ ] Clicking "+ Create New" switches to the Custom Exercises tab, creates the exercise for real (visible in the list), and opens its edit form pre-filled with the name — verified against the real running backend.
- [ ] The exact-match suppression (don't show "Create New" for a name that already exactly matches a real result) still works, unchanged from before this task.
- [ ] No second/duplicate form implementation anywhere in the sidebar.
- [ ] **Run the full frontend test suite** and confirm no regression to `auth.spec.ts`/other E2E tests that may reference the old "Create New" behavior (check `frontend/tests/e2e/plan-and-library.spec.ts` in particular, if it exists, since it exercises this exact flow).

## Review checklist
- [ ] Confirm this doesn't regress Task 38's fix (exact-match suppression) — that fix's history is worth checking before changing this condition.
- [ ] Get a quick visual check (screenshot or live browser check) of the repositioned callout before considering this done — visual prominence is a judgment call that benefits from actually looking at it.
