# Task 39 — Remove redundant manual Add Exercise form, resize target inputs, clarify Duration

## Objective
Three related Plan Builder polish items, agreed on after discussion:
1. Remove the old standalone "+ Add Exercise" button/form entirely — the exercise library sidebar (Tasks 36-38) now fully covers adding exercises (search, fuzzy match, custom creation), making this a redundant, strictly-worse second path (no suggestions, forces filling Sets/Reps/Weight before it'll submit). Replace it with a short explanatory line pointing at the sidebar.
2. On web (not mobile — leave mobile untouched, product owner is researching mobile-specific patterns separately), shrink the Sets/Reps/Weight/Duration input boxes in the **per-row exercise editing UI** (the controls used to configure an already-added exercise's targets) to fit their actual content, instead of a generic wide box for all of them.
3. Add a small info hint clarifying that "Duration" is a *target* (like target reps/target weight) — e.g. "treadmill: aim for 20 minutes" — not a stopwatch reading of how long a set took.

## Context

### Why the manual form can go away safely
`frontend/src/features/workoutPlans/PlanBuilder.tsx` currently has two ways to add an exercise to a day:
- The exercise library sidebar (`ExerciseLibrarySidebar`, unconditionally rendered at ~line 1536 — always visible, no toggle/collapse state), which now instant-adds via `handleQuickAddExercise` (Task 37) and has a "Create New: '...'" fallback for anything not in the library (Task 38).
- A standalone "+ Add Exercise" button (`onClick={() => setAddingExercise(true)}`, ~line 1440) that opens a form (~lines 1269-1440ish) with a bare `exerciseName` text input (no suggestions) plus Sets/Reps/Weight/Duration fields, submitted via `handleAddExercise`.

Since the sidebar is always present and now covers everything the manual form did (including custom exercises), the manual form is pure redundancy at this point.

### What must NOT be touched
There is a **separate, different** UI — the per-row editing controls for an exercise *already added* to a day (target sets/reps/weight editing, "vary by set" per-set overrides, the `has_reps`/`has_weight` cross-out/restore chips) — roughly lines 900-1120 in the same file. This is untouched by everything in this task except for the specific input-width and Duration-hint changes in requirements 2 and 3 below, which apply *to* this per-row UI (since that's what remains after the manual form is removed).

### Existing tooltip pattern to reuse
This file already uses native `title="..."` attributes for hover hints (e.g. `title="Cross out reps"`, `title="Remove exercise"` at various points in the per-row editing block) — no custom tooltip component exists or is needed. `InfoIcon` already exists in `frontend/src/components/icons.tsx`. Use the same `title=` pattern for the Duration hint, paired with a small `InfoIcon`, rather than introducing a new tooltip mechanism.

## Requirements

### 1. Remove the manual Add Exercise form
- Remove the "+ Add Exercise" button and the entire form it opens (the `addingExercise ? (...) : (...)` block and its associated JSX).
- Replace it with a short line of explanatory text, e.g. *"Add exercises using the panel on the right →"* (exact wording flexible, keep it brief and clearly pointing at the sidebar).
- Clean up now-dead state that was exclusively used by this form (`exerciseName`, `targetSets`, `targetReps`, `targetWeight`, `targetDurationSeconds`, `formHasReps`, `formHasWeight`, `formHasDuration`, `addingExercise`, and `handleAddExercise` itself) — **but first verify each one isn't also relied on by the shared `addExerciseToCurrentDay` function from Task 37** (that function must keep working for the sidebar's instant-add path) or by the per-row editing UI (which likely has its own separate local state per row — verify, don't assume). Don't delete anything still in use.

### 2. Resize per-row target inputs (web only)
In the per-row editing UI (the part that stays), size the Sets/Reps/Weight/Duration inputs to their actual content instead of a uniform wide box:
- **Sets** — narrow, ~50px (1-2 digits)
- **Reps** — wide enough for its placeholder text "e.g. 10 or 10-12" (~130-140px, since reps can be a range, not just a number)
- **Weight** — narrow, ~70-80px (a plain number)
- **Duration** — narrow, ~70-80px (seconds, a plain number)
Apply this only to the per-row editing UI's inputs, not to any mobile-specific layout (leave mobile styling exactly as it is — the product owner is researching mobile UX patterns separately and will follow up).

### 3. Clarify the Duration field's meaning
Next to the "Duration" `cell-label` in the per-row editing UI, add a small `InfoIcon` with a `title` attribute (matching the existing hover-hint pattern already used elsewhere in this file) reading something like: *"Target time to sustain this exercise (e.g. treadmill, plank) — not how long the set took."* Keep the label text itself as "Duration" — this is a hint addition, not a rename, per the product owner's preference (a longer label would work against the size reduction in requirement 2).

## Do NOT
- Do not touch the per-row "vary by set" / per-set-override editing UI's actual logic — only the input sizing and the Duration hint change.
- Do not change anything about the sidebar (`ExerciseLibrarySidebar.tsx`) — this task is entirely about `PlanBuilder.tsx`'s own layout.
- Do not change mobile styling/layout for these inputs.
- Do not remove `addExerciseToCurrentDay` (Task 37's shared add logic) or anything the sidebar's instant-add path depends on — only the form-specific UI and its exclusively-owned state goes away.

## Acceptance criteria
- [ ] The old "+ Add Exercise" button and its form are gone; in their place is a short line of text pointing at the sidebar.
- [ ] Adding an exercise is only reachable via the sidebar now (search/pick, or "Create New") — verify this still works end-to-end (instant add, default targets, configurable afterward — Task 37's behavior unchanged).
- [ ] On a normal desktop viewport, the Sets/Reps/Weight/Duration inputs in the per-row editing UI are visibly sized to their content (Reps noticeably wider than Sets/Weight/Duration, not all uniform).
- [ ] Mobile layout for these same inputs is pixel-for-pixel unchanged from before this task.
- [ ] Hovering the info icon next to "Duration" (per-row editing UI) shows the clarifying hint text.
- [ ] Vary-by-set editing, target sets/reps/weight editing, and the has_reps/has_weight cross-out/restore chips all still work exactly as before.
- [ ] No TypeScript errors; no leftover dead state/handlers from the removed form.

## Review checklist
- [ ] Confirmed (not assumed) which state variables were exclusively used by the removed form vs. shared with `addExerciseToCurrentDay` or the per-row editing UI, before deleting anything.
- [ ] No regression to Tasks 36-38's sidebar behavior (search, fuzzy match, instant-add, Create New fallback).
- [ ] Duration hint text doesn't get cut off or overflow awkwardly given the smaller input width from requirement 2.
