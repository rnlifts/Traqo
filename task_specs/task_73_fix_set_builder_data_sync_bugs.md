# Task 73 — Frontend (edit mode only): fix `target_sets` staleness and the Set 1 write race from Task 72

## Objective
Task 72 (collapsible set-by-set builder) shipped with two confirmed data-sync bugs in **edit mode** (`planId` set, not create mode) that were caught during independent verification — a real "add exercise → build 3 sets → save → start workout" walkthrough showed wrong pip counts in `ActiveWorkout.tsx`. This task fixes the root cause: edit mode has **two separate, uncoordinated write paths** for what is conceptually one value (an exercise's set data), and neither path keeps `target_sets` in sync. Fix both by consolidating to a single atomic write per edit. No backend changes needed or wanted — this is fixable entirely in `PlanBuilder.tsx`.

## Confirmed bugs (reproduced live, not theoretical)

**Bug A — `target_sets` never updated in edit mode.** `handleAddSet` (line 747) and `handleRemoveSet` (line 818) call `replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets)` — confirmed via `backend/src/modules/workouts/presentation/routes.py:835-902` that this endpoint ONLY replaces the `set_targets` array; it never touches the `target_sets` column. Neither handler follows up with a call to `updateExerciseInDay(..., { target_sets: updatedSets.length })`. Result: `target_sets` is frozen at whatever stale value it had (or `null`). `ActiveWorkout.tsx:276` does `return we.target_sets ?? 3;` for pip count — so a 1-set exercise can show 3 empty pips, or worse, show a stale count left over from before this exercise was edited with the new builder. Live proof: built an exercise with exactly 1 set in the new UI; `target_sets` stayed at a pre-existing stale value of `3`; Active Workout showed 3 pips for that 1-set exercise.

**Bug B — Set 1 has two divergent, racing write paths.** There are TWO different UI inputs that both claim to control "Set 1's" reps/weight/duration:
1. The main-row Reps/Weight/Duration inputs (onChange handlers at lines 1235, 1281, 1329) → call `handleUpdateExercise(exerciseId, field, value)` (line 531) → in edit mode, calls `updateExerciseInDay(...)` **immediately, no debounce** → `loadPlanForEdit()` immediately.
2. Set 1's own expanded-row inputs (onChange at lines 1443, 1455, 1466) → call `handleUpdateSet(exerciseId, 1, field, value)` (line 664) → which ALSO calls `handleUpdateExercise(...)` synchronously for the main-row sync (line 686-688), AND separately schedules a 500ms-debounced `replaceSetTargets(...)` (line 733-740) → its own later `loadPlanForEdit()`.

Two independent write+reload cycles fire from a single logical edit. Confirmed live via network trace: typing into Set 1's own field fires an immediate `PUT /exercises/{id}` + reload, followed by a debounced `PUT /exercises/{id}/set-targets` + a second reload. If the first reload lands before the debounced write finishes, it overwrites local `set_targets` state with pre-edit data — a visible revert. This is the most likely explanation for the "the plan doesn't appear to be saved yet" symptom noted during Task 72's own implementation.

**Bug C — related, same root cause, check for this while fixing A/B.** Once `set_targets` has any entries (i.e., after `handleAddSet` has ever been called, or `handleUpdateSet` has run once for this exercise), editing the MAIN-ROW Reps/Weight/Duration input goes through `handleUpdateExercise` only — it does **not** update `set_targets[0]`. Look at `ActiveWorkout.tsx:218,222,226`: `const reps = setOverride?.target_reps ?? we.target_reps` — if `set_targets[0]` (the override) exists but is stale, it **wins over** the freshly-updated `we.target_reps`, silently ignoring the user's main-row edit for Set 1's actual logged target. Verify this is real (it follows directly from the code, but confirm live: build 2+ sets on an exercise, then edit the *main-row* Reps field — not Set 1's own field — and check whether Active Workout's Set 1 pip reflects the new value or the stale one) and fix it as part of the same consolidation below.

## Root-cause fix — consolidate to one write path per edit

**In `handleUpdateSet` (line 664), edit-mode branch (currently line 728-743):**
Remove the separate immediate `handleUpdateExercise(...)` call for `setNumber === 1` (lines 685-689) — do not call it from here at all anymore. Instead, fold the main-row sync into the SAME debounced write:
```ts
} else if (planId) {
  const timeoutId = autoSaveTimeoutsRef.current.get(exerciseId);
  if (timeoutId) clearTimeout(timeoutId);

  const newTimeoutId = setTimeout(async () => {
    try {
      const exerciseUpdates: any = { target_sets: updatedSets.length };
      if (setNumber === 1) {
        if (field === 'reps') exerciseUpdates.target_reps = updatedSet.target_reps;
        if (field === 'weight') exerciseUpdates.target_weight = updatedSet.target_weight;
        if (field === 'duration') exerciseUpdates.target_duration_seconds = updatedSet.target_duration_seconds;
      }
      await Promise.all([
        replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
        updateExerciseInDay(planId, currentDay.id, exerciseId, exerciseUpdates),
      ]);
      await loadPlanForEdit();
    } catch (err) {
      setError((err as Error).message);
    }
  }, 500);

  autoSaveTimeoutsRef.current.set(exerciseId, newTimeoutId);
}
```
This gives one write, one reload, per edit — no race, and `target_sets` stays correct.

**In `handleAddSet` (line 747) and `handleRemoveSet` (line 818), edit-mode branches:**
Change the existing `await replaceSetTargets(...); await loadPlanForEdit();` to also send `target_sets` in the same batch:
```ts
await Promise.all([
  replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
  updateExerciseInDay(planId, currentDay.id, exerciseId, { target_sets: updatedSets.length }),
]);
await loadPlanForEdit();
```

**Main-row Reps/Weight/Duration inputs (Bug C, lines 1235/1281/1329):**
When `ex.set_targets` already has an entry for set 1 (i.e., `getSetsList(ex).length >= 1` and it came from real `set_targets`, not the synthesized fallback), a main-row edit must update `set_targets[0]` too, not just the exercise-level field. Simplest correct fix: route these three onChange handlers through `handleUpdateSet(ex.id, 1, field, value)` instead of `handleUpdateExercise(ex.id, field, value)` directly — `handleUpdateSet` already handles the create-mode vs edit-mode split and (after the fix above) will keep the exercise-level field and `set_targets[0]` consistent in one write. Confirm `handleUpdateSet`'s existing logic still produces the correct result when `ex.set_targets` is empty (i.e., no sets manually added yet, only the synthesized Set 1) — `getSetsList` synthesizes a length-1 array from the main row in that case, so `handleUpdateSet(ex.id, 1, ...)` should work identically to today's synthesized-Set-1 case, just now going through one path instead of two.

## Do NOT
- Do not touch the backend (`backend/src/modules/workouts/...`) — this is fixable entirely in `PlanBuilder.tsx`'s edit-mode write logic.
- Do not touch create-mode logic (`props.isCreateMode` branches) — `target_sets` is already correctly kept in sync with `set_targets.length` in the draft-state updates there; this task is edit-mode only.
- Do not touch `ActiveWorkout.tsx` — its `we.target_sets ?? 3` fallback and `setOverride?.x ?? we.x` precedence are correct, pre-existing behavior; the bug is that Plan Builder was feeding it stale/inconsistent data, not that Active Workout reads it wrong.
- Do not change the 500ms debounce timing or introduce a new debounce for `handleAddSet`/`handleRemoveSet` — those are discrete button actions, not keystroke streams; keep them immediate (just add the `target_sets` write to the same batch, as shown above).

## Acceptance criteria
- [ ] In edit mode, build an exercise with exactly 2 sets with different values, reload the page, and confirm `target_sets` (inspect via `GET /api/workout-plans/{id}` response, not just UI) equals `2`, not stale/null/3.
- [ ] Start a workout from that plan/day and confirm `ActiveWorkout.tsx` shows exactly 2 pips with the correct distinct pre-filled values per pip (not 3 pips, not both pips showing the same value).
- [ ] Edit Set 1 via its own expanded field, watch network requests: confirm exactly ONE write cycle (one `set-targets` PUT + one `exercises/{id}` PUT, ideally in parallel) followed by exactly ONE `GET /workout-plans/{id}` reload — not two separate reload cycles.
- [ ] Edit the MAIN-ROW Reps/Weight/Duration field (not Set 1's own field) on an exercise that already has 2+ built sets; reload; confirm the new value is reflected in both the main row AND Set 1's own displayed value, and confirmed via the raw API response that `set_targets[0]` was updated, not left stale.
- [ ] `+ Add Set` and `Remove Set` still work exactly as before (values copy-then-independent, renumbering, can't remove last set) — this task must not regress Task 72's already-correct behavior.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify the full cross-screen walkthrough one more time end-to-end (this is what caught the bugs — don't skip it): Plan Builder → build 3 distinct sets on one exercise → save → Active Workout → confirm exactly 3 correct pips.
- [ ] Confirm no duplicate/racing network requests fire for a single Set 1 edit (check via network tab / request log, not just visual result).
- [ ] Confirm create-mode (`isCreateMode`) is completely untouched and still works (build a plan from scratch with multi-set exercises, save, start workout, confirm correct pips) — this task must not introduce a create-mode regression while fixing edit-mode.
