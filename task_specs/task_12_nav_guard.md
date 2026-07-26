# Task 12 — Unsaved-changes nav guard during active workouts

## Objective
Warn the user before they navigate away from an in-progress workout session via the sidebar, the same way we already warn them when leaving an in-progress plan-creation flow.

## Context
- The app already has a generic guard for this: `UnsavedChangesContext` (`frontend/src/contexts/UnsavedChangesContext.tsx`) exposes `hasUnsavedChanges` / `setHasUnsavedChanges`, and `Layout.tsx` (lines ~23-38, ~110-124) intercepts sidebar nav clicks whenever `hasUnsavedChanges` is true, showing a `ConfirmDialog` ("Leave without saving?" / "Leave" / "Stay") before calling `navigate()`.
- `CreatePlanPage.tsx` (lines 20-30) shows the exact pattern to copy:
  ```tsx
  const { setHasUnsavedChanges } = useUnsavedChanges();
  useEffect(() => {
    setHasUnsavedChanges(true);
    return () => setHasUnsavedChanges(false);
  }, [setHasUnsavedChanges]);
  ```
- Active workouts render via `frontend/src/pages/ActiveWorkoutPage.tsx`, which renders `frontend/src/features/sessions/ActiveWorkout.tsx`. `ActiveWorkout.tsx` has a `workoutFinished` boolean state that flips to `true` once the user finishes/exits the workout (see `handleFinishWorkout` and `handleExit`) and renders a distinct "Workout complete!" screen.

## Requirements
1. In `ActiveWorkout.tsx`, import `useUnsavedChanges` from `../../contexts/UnsavedChangesContext`.
2. Add a `useEffect` that sets `hasUnsavedChanges` to `true` on mount and `false` on unmount (same cleanup pattern as `CreatePlanPage.tsx`).
3. Additionally set `hasUnsavedChanges` to `false` as soon as `workoutFinished` becomes `true` (the "Workout complete!" summary screen is not something the user should be nav-guarded away from — they're done). Do this either via a second effect keyed on `workoutFinished`, or by calling `setHasUnsavedChanges(false)` directly inside `handleFinishWorkout` and `handleExit` alongside `setWorkoutFinished(true)`.
4. Do NOT touch `Layout.tsx` or `UnsavedChangesContext.tsx` — they already work generically for any page that sets the flag.

## Do NOT
- Do not add a `beforeunload`/browser-tab-close warning — out of scope, sidebar nav only.
- Do not gate this on `isQuickStart` — both quick-start and real-plan sessions should be guarded.
- Do not show the guard on the "Workout complete!" screen — clicking "Done" there should navigate freely.

## Acceptance criteria
- [ ] Start any workout (quick-start or real plan), then click a sidebar link (Dashboard/Exercises/Plans/History) — a "Leave without saving?" confirm dialog appears, matching the one used during plan creation.
- [ ] Clicking "Stay" keeps you on the active workout page with all logged sets intact.
- [ ] Clicking "Leave" navigates away.
- [ ] Finish the workout (or exit it) so the "Workout complete!" screen shows, then click a sidebar link — no confirm dialog appears, navigation happens immediately.
- [ ] Navigating away from the active workout page any other way (e.g. browser back button) does not crash the app; `hasUnsavedChanges` resets to `false` (verify by then navigating from Dashboard to another page with no stray confirm dialog appearing).

## Review checklist
- [ ] `setHasUnsavedChanges` is imported and called correctly with no infinite render loop (effect dependency array is `[setHasUnsavedChanges]` only, not `[hasUnsavedChanges]`).
- [ ] TypeScript compiles with no new errors.
- [ ] No changes made to `Layout.tsx` or `UnsavedChangesContext.tsx`.
