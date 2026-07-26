# Task 19 — Make "Vary by set" show the right fields per exercise (Reps/Weight/Duration)

**Depends on Task 18 — `target_duration_seconds` must already exist on per-set overrides (backend, schemas, and `WorkoutExercise.set_targets` TypeScript type) before this task, which is UI-only.**

## Objective
Plan Builder's "Vary by set" panel currently shows a Reps input and a Weight input for every set, unconditionally — even for exercises where those fields are crossed out (`has_reps`/`has_weight` false) and even for duration-only exercises like cardio, which need a Duration input instead. Make each set's row in the panel show exactly the fields that exercise's main row shows: Reps if `has_reps`, Weight if `has_weight`, Duration if `has_duration`.

## Context
- File: `frontend/src/features/workoutPlans/PlanBuilder.tsx`.
- The main exercise row (~lines 869-984) already does this correctly: `ex.has_reps ? <Reps input> : <+ Reps chip>`, same pattern for `has_weight` and `has_duration` (duration uses `<DurationInput>` from `frontend/src/components/DurationInput.tsx`, imported already in this file).
- The "Vary by set" panel (~lines 1059-1105) does NOT follow this pattern — it hardcodes a Reps text input and a Weight number input for every set row, with no check against `ex.has_reps`/`ex.has_weight`/`ex.has_duration` at all, and no Duration input exists in the panel.
- Each set row's edit state lives in `perSetEdits` (from `perSetEditsByExerciseId`, a `Map<exerciseId, SetTarget[]>`) — after Task 18, each entry now has `{ set_number, target_reps, target_weight, target_duration_seconds }`.
- **Task 14's Set-1-sync interaction (important — this is what caused the original bug report):** the panel's Reps/Weight `onChange` handlers currently call `handleUpdateExercise(ex.id, 'reps'/'weight', newValue)` when `setNum === 1`, to keep Set 1 synced with the main row (added in Task 14). This sync must now extend to Duration too, AND it must only fire for fields the exercise actually has — don't let a hidden/inapplicable field's input (which shouldn't render at all after this fix) leak a value into the main row.

## Requirements
1. For each set row in the "Vary by set" panel, mirror the main row's conditional rendering:
   - Show the Reps text input only if `ex.has_reps` is true.
   - Show the Weight number input only if `ex.has_weight` is true.
   - Show a `<DurationInput>` only if `ex.has_duration` is true, bound to `currentSetEdit.target_duration_seconds`, with `onChange` updating that set's `target_duration_seconds` in `perSetEditsByExerciseId` (same pattern as the existing Reps/Weight `onChange` handlers — replace the matching `set_number` entry in the array).
   - If an exercise has none of `has_reps`/`has_weight`/`has_duration` — not currently possible via the UI (crossing out all three isn't exposed) — leave this edge case unhandled/whatever falls out naturally; not worth extra guarding.
2. **Extend the Set-1 ↔ main-row sync from Task 14 to cover Duration**: when Set 1's Duration input changes in the panel, also call `handleUpdateExercise(ex.id, 'target_duration_seconds', value)` (the field name `handleUpdateExercise` already accepts for duration — check its `field === 'target_duration_seconds'` branch, already implemented). Symmetrically, when the main row's Duration changes (via its existing `<DurationInput onChange={...}>`, ~line 972) and the panel has been opened for that exercise (`perSetEditsByExerciseId.has(ex.id)`), also update Set 1's `target_duration_seconds` in `perSetEditsByExerciseId` — same pattern already used for Reps/Weight sync in the main row's `onChange` handlers (~lines 877-891, 926-940).
3. **Extend Task 14b's initial-seeding fix to Duration**: when the panel is opened for the first time (`!perSetEditsByExerciseId.has(ex.id)`), Set 1 should seed `target_duration_seconds` from `ex.target_duration_seconds` under the same condition as Task 14b used for reps/weight (i.e., only seed if Set 1's existing per-set `target_duration_seconds` is `null` — don't clobber a real saved override).
4. Since each set row's fields now vary in count (1-3 inputs depending on flags), don't assume a fixed 2-column layout — let `.set-line` (already flex-based per earlier CSS work) accommodate however many fields render.

## Do NOT
- Do not change what fields the main exercise row shows — this task only makes the per-set panel match what's already there.
- Do not touch the backend further — Task 18 already made `target_duration_seconds` round-trip correctly on `set_targets`; this task only wires the frontend UI to read/write it.
- Do not sync Sets 2+ for duration, same restriction Task 14 established for reps/weight — only Set 1 syncs with the main row.
- Do not break the existing Reps/Weight sync behavior (already verified working in Task 14/14b) while adding Duration.

## Acceptance criteria
- [ ] Create/edit an exercise with `has_duration: true`, `has_reps: false`, `has_weight: false` (e.g. cross out Reps and Weight, add Duration on the main row). Click "Vary by set" — each set row shows only a Duration input, no Reps/Weight inputs.
- [ ] Set the main row's Duration to 1h. Open "Vary by set" fresh (never opened before for this exercise) — Set 1's Duration shows 1:00:00, seeded from the main row (mirrors Task 14b's reps/weight seeding behavior).
- [ ] With the panel open, change the main row's Duration — Set 1's Duration updates live in the panel (mirrors Task 14's live sync).
- [ ] With the panel open, change Set 1's Duration in the panel — the main row's Duration updates live.
- [ ] Set Set 2's Duration to something different (e.g. 30 min) — it does NOT affect the main row or Set 1.
- [ ] Click "Save set targets" — reload the plan, confirm per-set durations persisted correctly (`GET` shows each set's own `target_duration_seconds`).
- [ ] For a normal reps/weight exercise (has_duration false), "Vary by set" is unaffected — still shows Reps + Weight per set, no Duration input, exactly as it worked before this task (Task 14/14b behavior unchanged).
- [ ] Start a workout from this duration-only exercise's plan — each set's panel (in `ActiveWorkout.tsx`) correctly prefills from its own per-set `target_duration_seconds` override, not a blank or wrong value. (This exercises the `openSetPanel` per-set-override lookup in `ActiveWorkout.tsx`, which the spec's Task 18 already made compatible — verify it end-to-end here since this is the first time real duration per-set data exists to test with.)

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: a duration-only exercise's Vary-by-set panel, save, reload, and an actual workout session opening a per-set duration override — not just read from code.
