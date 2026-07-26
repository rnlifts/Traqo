# Task 17 — Show "log set" validation errors inline in the exercise's panel, not at the top of the page

## Objective
When logging a set fails validation (e.g. no weight/reps/duration entered) for an exercise further down the workout (say, the 3rd exercise), the error message should appear right next to the set panel the user is working in, not in a banner at the top of the page that requires scrolling up to see.

## Context
- File: `frontend/src/features/sessions/ActiveWorkout.tsx`.
- There is a single page-level `error` state (`const [error, setError] = useState<string | null>(null);`) set by several handlers, including `handleLogSet` (line ~306: `setError("At least one of weight, reps, or duration is required")`) and `handleDeleteSet`, `handleExit`, `handleFinishWorkout`, `handleSavePlanName`, `handleAddExerciseToDay` — it's shared across many unrelated actions.
- It's rendered once, near the top of the page, above the exercise cards (lines ~712-739):
  ```tsx
  {error && (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="error-message">
      <span>{error}</span>
      <button onClick={() => setError(null)} ...>×</button>
    </div>
  )}
  ```
- The set-logging panel itself (opened via `openSetPanel`, rendered per-exercise inside the `.map()` over `planExercises`, around lines 877-1158) has no error display of its own — a validation failure from `handleLogSet` or `handleDeleteSet` only shows up in that shared top banner, which is out of view if the user has scrolled down to a later exercise.

## Requirements
1. Render the error inline inside the currently-open set panel, in addition to (or instead of — see below) the top banner, so it's visible without scrolling.
2. Scope: this should apply specifically to errors coming from `handleLogSet` and `handleDeleteSet` (the two actions triggered from within an open set panel). Errors from other actions (exit, finish workout, rename plan, add exercise) are triggered from UI elsewhere on the page and should keep using the existing top banner — don't try to relocate those.
3. Suggested approach: keep the single `error` state as-is (simplest, avoids restructuring state), but change what's rendered:
   - Inside the set panel block (where `activePanelExerciseId === we.id && activePanelSetNumber !== null`), add an inline error display (reusing the `.error-message` class, or similar styling) shown when `error` is non-null AND `activePanelExerciseId === we.id` — i.e. the error belongs to *this* exercise's currently-open panel.
   - When an error is being shown inline for the open panel, suppress the top banner for that same error (to avoid showing the identical message twice on screen) — e.g. only render the top banner when `error && activePanelExerciseId === null` (no panel currently open, so there's nowhere inline to put it — covers the exit/finish/rename/add-exercise cases which don't have an open set panel at that moment... verify this holds; if any of those actions can fire while a set panel happens to be open, adjust so the top banner still shows for those specific actions instead of relying purely on `activePanelExerciseId`).
   - Place the inline error near the top of the panel (above or below the "Set N" heading) so it's immediately visible when the panel is open, and keep the existing dismiss (×) behavior.
4. Make sure closing the panel (`closeSetPanel`) also clears the error, so a stale error message doesn't linger and reappear if the user reopens a different panel. Check `closeSetPanel` (line ~286) — it currently doesn't touch `error`; add `setError(null)` there, and also clear it at the start of `openSetPanel` when switching to a different exercise/set.

## Do NOT
- Do not create a separate error-state-per-exercise data structure — the single shared `error` string plus the `activePanelExerciseId` scoping check described above is sufficient and simpler.
- Do not change the error message text itself or the validation logic in `handleLogSet`/`handleDeleteSet`.
- Do not remove the top banner entirely — it's still needed for the other action handlers (rename, finish, exit, add exercise) that aren't tied to an open panel.

## Acceptance criteria
- [ ] Scroll down to the 3rd (or later) exercise in a workout with several exercises, open its set panel, click "✓ Log set" without entering weight/reps/duration — an error message appears directly inside/near that exercise's panel, visible without scrolling up.
- [ ] The top-of-page banner does NOT also show the same message at the same time (no duplicate).
- [ ] Fix the weight/reps and click "✓ Log set" again — it saves successfully and the inline error clears.
- [ ] Close the panel (Cancel) while an error is showing — reopening a panel (same or different exercise) does not show the stale error.
- [ ] Trigger an unrelated error, e.g. finish workout while offline/API failing (or a similar reproducible error not tied to a set panel) — confirm it still shows in the top banner as before.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: reproduced the exact scenario (3rd+ exercise, empty submit, scrolled view) and confirmed the message is visible without scrolling.
