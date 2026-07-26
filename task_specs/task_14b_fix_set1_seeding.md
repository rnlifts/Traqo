# Task 14b — Fix: Set 1 shows blank instead of the main row's values when opening "Vary by set"

## Objective
Task 14's live sync (main row ↔ Set 1) works correctly once the panel is open, but the initial seeding is broken: opening "Vary by set" on an exercise that's never had per-set overrides shows Set 1's Reps/Weight fields blank instead of pre-filled with the main row's current Reps/Weight.

## Root cause (confirmed live, no further investigation needed)
`frontend/src/features/workoutPlans/PlanBuilder.tsx`, ~line 1006:
```tsx
const initialEdits = ex.set_targets && ex.set_targets.length > 0 ? ex.set_targets : Array.from({ length: numSets }, (_, i) => {
  // Seed Set 1 with main row's reps/weight, others empty
  if (i === 0) {
    return { set_number: 1, target_reps: ex.target_reps, target_weight: ex.target_weight };
  }
  return { set_number: i + 1, target_reps: null, target_weight: null };
});
```
The backend always returns `set_targets` as a fully-populated array (one entry per `target_sets`, with `target_reps`/`target_weight` as `null` if never overridden) — confirmed live via `GET /workout-plans/:id`, e.g. `"set_targets":[{"set_number":1,"target_reps":null,"target_weight":null},{"set_number":2,...},{"set_number":3,...}]`. Since this array's `.length` is always `> 0` whenever the exercise has any planned sets, the ternary always takes the `ex.set_targets` branch — the "seed from main row" branch on the right-hand side can never execute. It's dead code.

## Requirements
1. Change the seeding logic so it seeds Set 1 from the main row's `target_reps`/`target_weight` specifically when Set 1's entry in `ex.set_targets` has no real override yet (i.e. `target_reps === null && target_weight === null` for `set_number === 1`), regardless of whether the rest of the array is "empty" or not. Sets 2+ should keep using whatever `ex.set_targets` already has for them (including `null`, if genuinely un-overridden — don't seed those from anything).
2. Concretely: build `initialEdits` by mapping over `ex.set_targets` (falling back to the `Array.from({length: numSets}, ...)` shape only if `ex.set_targets` is missing/empty entirely), and for the `set_number === 1` entry specifically, if both `target_reps` and `target_weight` are `null` there, replace them with `ex.target_reps`/`ex.target_weight`.
3. This only affects the *initial* seed when the panel is opened and no local edit state exists yet for that exercise (`!perSetEditsByExerciseId.has(ex.id)`) — unrelated to the live main-row-↔-Set-1 sync added in Task 14, which already works correctly and should not be touched.

## Do NOT
- Do not change what the backend returns for `set_targets` — this is a frontend-only seeding fix.
- Do not seed Sets 2+ from anything — only Set 1.
- Do not touch the live sync `onChange` handlers added in Task 14 (main row ↔ Set 1) — those are confirmed working correctly via live testing.

## Acceptance criteria
- [ ] Set an exercise's main row Reps to "8" and Weight to "135" (an exercise that has never had "Vary by set" opened/saved before). Click "Vary by set" — Set 1's Reps field shows "8" and Weight field shows "135" immediately (not blank).
- [ ] For an exercise that already has a genuine Set 1 override saved (e.g. previously saved via "Save set targets" with Set 1 reps "6"), opening "Vary by set" shows that saved override ("6"), not the main row's value — i.e. this fix must not clobber real saved overrides.
- [ ] Sets 2+ still show blank (or their saved override, if any) when the panel is first opened — unaffected by this fix.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: reproduced the exact repro above (fresh exercise, click Vary by set, check Set 1's field values in the DOM) and confirmed the fix, not just read from code.
