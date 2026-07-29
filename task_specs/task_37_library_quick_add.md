# Task 37 — Exercise library "+" should add directly, not just pre-fill the form

## Objective
Fix a real UX complaint from using Task 36's sidebar live: clicking "+" on a library result currently only pre-fills the exercise name into the Add Exercise Form — the user then has to click "Add" a *second* time on the form itself to actually get the exercise into their plan. That's one click too many. Clicking "+" should add the exercise to the currently active day **immediately**, with empty/default targets — the user configures sets/reps/weight afterward using the row-level editing controls that already exist once an exercise is in the day (confirmed present in `PlanBuilder.tsx` — target_sets/target_reps/target_weight/has_reps/has_weight are already editable per-row after an exercise has been added, this is not new functionality to build).

## Context
- `frontend/src/features/workoutPlans/PlanBuilder.tsx`'s `handleAddExercise` (~line 372) is the existing "find-or-create exercise, then add a WorkoutExercise row to the current day" logic. It currently reads its target values from form state (`targetSets`, `targetReps`, `targetWeight`, `formHasReps`, `formHasWeight`, `formHasDuration`) and requires the form to be submitted.
- Default flag values already established elsewhere in this file: `formHasReps` defaults to `true`, `formHasWeight` defaults to `true`, `formHasDuration` defaults to `false` (lines ~100-108) — this is the standard "weight + reps" default logging shape used throughout the app. Use these same defaults for a library quick-add (empty `target_sets`/`target_reps`/`target_weight`, `has_reps: true`, `has_weight: true`, `has_duration: false`) so a quick-added exercise looks and behaves identically to a manually-added exercise where the user just didn't fill in targets yet.
- Task 36 wired the sidebar's "+" to call an `onSelectExercise: (name: string) => void` callback that currently populates `exerciseName` and opens the form (per that task's spec — this was a deliberate, clearly-flagged design decision at the time, and this task is the correction based on actual usage).

## Requirements
1. Change what happens when the sidebar's "+" (and the "Create New Exercise" fallback) fires: instead of populating the form and waiting for a second manual submit, directly perform the same "find or create exercise, then add to current day" logic that `handleAddExercise` already does — but with default empty targets (`target_sets: null`, `target_reps: null`, `target_weight: null`, `target_duration_seconds: null`, `has_reps: true`, `has_weight: true`, `has_duration: false`) instead of reading from form state. The cleanest way to do this without duplicating logic: refactor the core "materialize exercise + add to day" logic out of `handleAddExercise` into a small reusable function that both the form's submit handler and the new quick-add path call, parameterized by the target values instead of always reading them from form state.
2. After a quick-add succeeds, give the user some lightweight confirmation it worked (e.g. a toast, matching the toast pattern already used elsewhere in this file/app) — don't leave them wondering whether "+" did anything, since there's no longer a form submission to visually confirm it.
3. The existing manual "Add Exercise Form" (with its Sets/Reps/Weight/Duration fields, opened via whatever trigger already opens it outside the sidebar) stays exactly as it is — this task only changes the sidebar's "+" and "Create New Exercise" paths, not the manual entry flow for anyone who wants to configure targets at add-time by typing a name directly.
4. Confirm (this should already be true, but verify while doing this) that an exercise added with null targets and `has_reps`/`has_weight` defaults renders correctly in the day's exercise list with its inline editing controls ready to use — i.e. the "configure later" story actually works end-to-end, not just that the row gets added.

## Do NOT
- Do not duplicate the "find or create exercise" / "add to day" logic in two places — refactor to share it between the form's submit and the new quick-add path.
- Do not change the manual Add Exercise Form's behavior for users who reach it directly (not via the sidebar).
- Do not change the per-row target-editing UI that already exists — this task relies on it already working, not modifies it.

## Acceptance criteria
- [ ] Clicking "+" on a library result in the sidebar adds that exercise to the currently active day immediately — no second click required, no form left open needing submission.
- [ ] The newly-added exercise appears in the day's list with empty/default targets and `has_reps`/`has_weight` on, `has_duration` off — matching what a manually-added exercise with no targets typed would look like today.
- [ ] A toast (or equivalent lightweight confirmation) appears after a successful quick-add.
- [ ] The user can immediately use the existing per-row controls to fill in sets/reps/weight on the just-added exercise, and it saves correctly (this is pre-existing functionality — just confirm it isn't broken by this change).
- [ ] "Create New Exercise" (the no-match fallback) behaves the same way — instant add with default targets, not a pre-fill-then-submit flow.
- [ ] The manual Add Exercise Form (reached without going through the sidebar) still works exactly as before — still requires filling in the name and clicking "Add," still respects whatever Sets/Reps/Weight/Duration values are typed.
- [ ] No TypeScript errors.

## Review checklist
- [ ] "Find or create exercise + add to day" logic exists in exactly one shared function, called by both the form submit and the new quick-add path — not copy-pasted.
- [ ] No regression to Task 36's search/filter/thumbnail behavior — this task only changes what happens after "+" is clicked, not the browsing experience itself.
