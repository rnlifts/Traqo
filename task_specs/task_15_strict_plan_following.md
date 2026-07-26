# Task 15 — Real plans must strictly follow the plan (no ad-hoc exercises/sets)

**Send this task before Task 16 — Task 16's fix builds directly on the gating this task introduces.**

## Objective
For a real, trainer-built plan (`isQuickStart === false`), a client should not be able to add exercises mid-workout or log sets beyond what was planned. Both of those should remain available only for quick-start sessions.

## Context
- File: `frontend/src/features/sessions/ActiveWorkout.tsx`. `isQuickStart` is a prop, already wired through from `frontend/src/pages/ActiveWorkoutPage.tsx:166` (`isQuickStart={!!planDetail.plan.is_quick_start}`).
- **"+ Add Exercise" mid-workout**: rendered unconditionally whenever `planId && dayId` are present (lines ~1211-1260):
  ```tsx
  {planId && dayId && (
    <div style={{ marginBottom: "20px" }}>
      {isAddingExercise ? ( ... ) : (
        <button onClick={() => setIsAddingExercise(true)} className="btn" ...>
          + Add Exercise
        </button>
      )}
    </div>
  )}
  ```
- **Extra-set "+" pip** (lets the user log a set beyond the planned count): rendered unconditionally after the target pips, inside the exercise card's pips row (lines ~853-874):
  ```tsx
  <button
    onClick={() => openSetPanel(we.id, pipCount + 1)}
    aria-label={`Add extra set`}
    ...
  >
    +
  </button>
  ```
  (Note: this button's target set number has a separate known bug, fixed in Task 16 — for this task, just gate its *visibility*, don't change its click logic.)
- `getPipCount(we)` returns `we.target_sets ?? 3` — this is the planned set count per exercise, already correct and unrelated to this task.

## Requirements
1. Wrap the entire "+ Add Exercise" block (the whole `{planId && dayId && (...)}` section) in an additional `isQuickStart` check, so it only renders for quick-start sessions: `{isQuickStart && planId && dayId && (...)}`.
2. Wrap the extra-set "+" pip button in an `isQuickStart` check as well, so for real plans, exercise cards show exactly `pipCount` pips (the planned sets) and nothing more.
3. For real plans, once all `pipCount` sets for an exercise are logged, there is intentionally no way to log more for that exercise — this is correct per the requirement, not a bug to work around.
4. Quick-start sessions keep both features exactly as they work today (no behavior change there).

## Do NOT
- Do not remove the ability to *edit or delete* an already-logged set on a real plan (tapping an existing numbered pip to open its panel and change/delete the value should still work) — this task only removes the ability to add exercises/sets beyond the plan, not to edit what's already there.
- Do not touch backend validation — `AddWorkoutSet`'s permissive validation stays as-is; this is a frontend-only UI restriction (consistent with how `has_reps`/`has_weight`/`has_duration` are already UI-only concerns, never backend-enforced).
- Do not change `getPipCount`'s calculation.

## Acceptance criteria
- [ ] Start a workout from a real (trainer-built, non-quick-start) plan — no "+ Add Exercise" button appears anywhere on the page, and no dashed "+" extra-set pip appears on any exercise card (only the planned number of pips per exercise).
- [ ] Start a quick-start workout (e.g. via "Quick Start" / an empty ad-hoc session) — both "+ Add Exercise" and the dashed "+" extra-set pip still appear and work exactly as before.
- [ ] On a real plan, tapping an already-logged numbered pip still opens its panel for editing/deleting — unaffected by this change.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live with both a real plan and a quick-start session in the same browser session, not just one or the other.
