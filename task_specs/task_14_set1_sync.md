# Task 14 — Sync Vary-by-set's Set 1 with the exercise row's main Reps/Weight

## Objective
In Plan Builder, an exercise row's main Reps/Weight fields and the "Vary by set" panel's Set 1 override should behave as one value, not two independent ones that can drift apart. Editing either should update the other.

## Context
- File: `frontend/src/features/workoutPlans/PlanBuilder.tsx`.
- The main row's Reps/Weight inputs call `handleUpdateExercise(ex.id, 'reps', ...)` / `handleUpdateExercise(ex.id, 'weight', ...)` (around lines 869-937), which updates `ex.target_reps` / `ex.target_weight` on the exercise itself.
- The Vary-by-set panel (opened via `varyBySetRows`, rendered ~line 1011 onward) keeps its own separate local state, `perSetEditsByExerciseId` (a `Map<exerciseId, SetTarget[]>`), seeded when the panel is opened:
  ```tsx
  const initialEdits = ex.set_targets && ex.set_targets.length > 0 ? ex.set_targets : Array.from({ length: numSets }, (_, i) => ({
    set_number: i + 1,
    target_reps: null,
    target_weight: null,
  }));
  ```
  Each set row (including Set 1) renders its own reps/weight `<input>` (~lines 1018-1045) that only writes into `perSetEditsByExerciseId`, never touching `ex.target_reps`/`ex.target_weight`.
- These two are currently fully decoupled: changing the main row's Reps does not touch `perSetEdits[0]`, and changing Set 1 in the panel does not touch `ex.target_reps`.

## Requirements
1. **Main row → Set 1 (when panel is open/being edited)**: when the user edits the main row's Reps or Weight for an exercise, and that exercise currently has an entry in `perSetEditsByExerciseId` (i.e. vary-by-set panel has been opened for it, whether currently visible or not), also update that exercise's `set_number === 1` entry in `perSetEditsByExerciseId` to match.
2. **Set 1 → main row**: when the user edits Set 1's reps or weight inside the Vary-by-set panel, also call the same update path the main row uses (`handleUpdateExercise(ex.id, 'reps', value)` / `handleUpdateExercise(ex.id, 'weight', value)`) so `ex.target_reps`/`ex.target_weight` stay in sync.
3. Sets 2+ remain independent — this syncing only applies to Set 1, since Set 1 conceptually *is* the exercise's main target.
4. Make sure this doesn't create an infinite update loop (updating main row triggers Set 1 update triggers main row update, etc.) — guard by only propagating when the value actually differs, or by having one direction be the "source of truth" write into shared derived state rather than two independent effects chasing each other. Simplest safe approach: handle both as part of the same `onChange` handler pair (main-row's onChange also writes perSetEdits directly; Set-1's onChange also calls `handleUpdateExercise` directly) rather than using a `useEffect` that watches both and could loop.
5. When "Save set targets" is clicked, the payload sent via `replaceSetTargets` should reflect whatever Set 1 currently shows (already true once requirement 1/2 keep them synced — no separate change needed to the save call itself).

## Do NOT
- Do not merge the two into a single shared state variable/data structure — keep `ex.target_reps`/`target_weight` and `perSetEditsByExerciseId` as they are structurally; just keep their Set-1 values synchronized on every edit.
- Do not sync Sets 2+ with anything.
- Do not change what gets sent to the backend beyond what naturally follows from the values now being consistent.

## Acceptance criteria
- [ ] Open Plan Builder, set an exercise's main Reps to "8" and Weight to "135". Click "Vary by set" — Set 1's reps/weight fields show "8" and "135" (not blank/different).
- [ ] With the panel still open, change the main row's Reps to "10" — Set 1's reps field updates to "10" live, without needing to close/reopen the panel.
- [ ] With the panel open, change Set 1's weight in the panel to "140" — the main row's Weight field updates to "140" live.
- [ ] Editing Set 2 or Set 3 does NOT affect the main row or Set 1.
- [ ] Click "Save set targets" — reload the plan and confirm both the main row values and Set 1's override are consistent and correctly persisted (no drift between what the row shows and what `set_targets[0]` contains).
- [ ] No infinite re-render loop or console warnings when typing in either field.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live in-browser, typing in both directions, not just read from code.
