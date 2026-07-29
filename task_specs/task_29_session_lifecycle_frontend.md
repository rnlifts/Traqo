# Task 29 — Frontend: Save & Exit / Discard dialog + unresolved-session dashboard banner

## Objective
Replace the current Exit button (which silently marks the session finished) with a real choice between "Save & Exit" (keep logged sets, stay resumable) and "Discard" (delete today's sets). Add a Dashboard banner that catches every other way a session can be left dangling (nav-away, back button, tab close, refresh, power cut) by surfacing the user's unresolved session with Resume/Discard/Mark-as-Finished options. Update plan deletion to reflect that it's no longer blocked, just warned about.

Depends on Task 28 (backend endpoints: `GET /workout-sessions/unresolved`, `DELETE /workout-sessions/{id}`, `409` on starting a session while one is unresolved).

## Context
- `frontend/src/features/sessions/ActiveWorkout.tsx:433-443` — `handleExit` currently just calls `workoutSessionsApi.finishWorkout(session.id)` and sets `workoutFinished = true`. There's an existing "Exit confirmation banner" UI block around line 644 with a button wired to `handleExit` at line 671 — this is the surface to change, not remove.
- `frontend/src/api/workoutSessionsApi.ts` has the full existing API client (`finishWorkout`, `getSessionDetail`, etc.) — add new methods here following the same pattern.
- Resuming a session already works structurally: `frontend/src/pages/ActiveWorkoutPage.tsx` loads any session by `sessionId` route param (`/workout-sessions/:sessionId`, registered in `App.tsx:77-84`) via `workoutSessionsApi.getSessionDetail`. "Resume" is just `navigate(`/workout-sessions/${session.id}`)` — no new page needed.
- `frontend/src/pages/Dashboard.tsx` currently fetches only `getWorkoutHistory()` on mount (lines 15-28) and renders a "Recent workouts" list. The new banner goes above that.
- `frontend/src/features/workoutPlans/PlanList.tsx:61-78,163-170` already has a working delete-confirm dialog (`ConfirmDialog`) wired to `deleteWorkoutPlan` — it will keep working once the backend stops blocking it (Task 28); only the warning copy needs updating.
- `UnsavedChangesContext` (`frontend/src/contexts/UnsavedChangesContext.tsx`) already guards in-app sidebar nav away from an active workout with a "Leave without saving?" dialog (Task 12) — that mechanism is unaffected by this task and needs no changes; it's a separate, already-working safety net for in-app navigation specifically.

## Requirements

### 1. API client additions (`frontend/src/api/workoutSessionsApi.ts`)
```ts
async discardSession(sessionId: number): Promise<void> {
  await client.delete(`/workout-sessions/${sessionId}`);
},

async getUnresolvedSession(): Promise<WorkoutSession | null> {
  const response = await client.get<{ session: WorkoutSession | null }>(
    "/workout-sessions/unresolved"
  );
  return response.data.session;
},
```

### 2. Exit button → Save & Exit / Discard
In `ActiveWorkout.tsx`, replace `handleExit`'s body. The existing exit-confirmation banner (~line 644) should present two distinct actions instead of one:
- **Save & Exit**: no API call (sets are already persisted as each one is logged). Just `setHasUnsavedChanges(false)` and navigate away (match whatever the current post-exit navigation target is — check what `workoutFinished` currently leads to, or navigate to `/dashboard`). Session remains unresolved server-side (`completed_at` still `NULL`) — this is intentional, it's what makes it resumable later.
- **Discard**: show a second, explicit confirm step ("This will permanently delete today's logged sets for this workout. This can't be undone." / Cancel / Discard) before calling `workoutSessionsApi.discardSession(session.id)`, then navigate away the same way. Use the existing `ConfirmDialog` component (see `PlanList.tsx` for the pattern) rather than inventing a new one.

Do not touch `handleFinishWorkout` (the separate "Finish workout" button/flow) — it keeps marking the session complete exactly as it does today.

### 3. Dashboard unresolved-session banner (`Dashboard.tsx`)
On mount, call `workoutSessionsApi.getUnresolvedSession()` alongside the existing `getWorkoutHistory()` fetch. If a session is returned, render a banner above "Recent workouts" (visually distinct — treat it like an alert/notice, not a normal list row) reading something like:
> "You have an unfinished workout — **`{plan_name}`** (`{day_label}`), started `{formatted started_at}`."
with three actions:
- **Resume** → `navigate(`/workout-sessions/${session.id}`)`.
- **Mark as Finished** → call `workoutSessionsApi.finishWorkout(session.id)`, then clear the banner and show a success toast ("Workout marked as finished!"), matching the toast pattern already used elsewhere (see `showToast` usage in `ActiveWorkout.tsx` or `PlanList.tsx`).
- **Discard** → same confirm-then-delete pattern as the Exit button's Discard (reuse `ConfirmDialog`), calling `workoutSessionsApi.discardSession(session.id)`, then clear the banner and toast ("Workout discarded.").

After any of the three actions, don't re-fetch automatically expecting another unresolved session to appear — a user can only have one unresolved session at a time once Task 28's block is in place, so just hide the banner locally.

### 4. Handle the 409 when starting a new workout
Anywhere the frontend currently calls `workoutSessionsApi.startWorkout(...)` or `workoutSessionsApi.quickStart()` (find both call sites — likely `SessionSetupPage` and wherever the "Quick Start" button lives), catch a `409` response and show a clear message directing the user to resolve their existing session first (e.g. a toast: "Finish or discard your unresolved workout before starting a new one," then `navigate('/dashboard')` so the banner from step 3 is immediately visible). Don't let this surface as a generic/unhandled error.

### 5. Plan delete warning copy
In `PlanList.tsx`, update the `ConfirmDialog` `message` prop (currently "Are you sure you want to delete this workout plan? This action cannot be undone.", line ~166) to make the data-loss explicit, e.g.: "Are you sure you want to delete this workout plan? This will permanently delete the plan and all of its logged workout history. This cannot be undone." No other changes needed here — the delete call itself already works and will simply stop failing once Task 28 lands.

## Do NOT
- Do not add a `beforeunload`/tab-close browser warning — still explicitly out of scope (per Task 12's original decision, still valid: the Dashboard banner is the safety net for all non-in-app exits, not a per-exit-path interception).
- Do not change `handleFinishWorkout` or the separate Finish button's behavior.
- Do not build a UI for deleting individual finished/completed sessions from history — only unresolved-session discard (Exit dialog, Dashboard banner) and whole-plan delete are in scope.
- Do not change `UnsavedChangesContext.tsx` or `Layout.tsx`'s existing in-app nav guard — leave it as-is.
- Do not poll for unresolved sessions repeatedly — one fetch on Dashboard mount is enough.

## Acceptance criteria
- [ ] Start a workout, log at least one set, click Exit → see Save & Exit / Discard choice (not an immediate finish).
- [ ] Save & Exit → navigates away; session does NOT appear in Workout History (still unresolved); reload Dashboard → banner appears showing that session.
- [ ] From the banner, click Resume → lands back in the exact same active workout with the previously logged set(s) still visible, able to keep logging.
- [ ] From the banner (or the Exit dialog), click Discard → after confirming, session and its sets are gone; reload Dashboard → banner no longer appears; the plan/day used still exist (for a real plan) and are otherwise unaffected.
- [ ] From the banner, click Mark as Finished → session now appears in Workout History; banner disappears.
- [ ] Start a workout, leave via browser back button (not the in-app Exit button) → session doesn't crash anything; reload Dashboard → banner appears for that session, same as the Save & Exit case.
- [ ] With an unresolved session pending, try to start a new quick workout → blocked with a clear message, no duplicate plan/day/session created.
- [ ] Delete a plan that has a finished, logged session → confirm dialog shows the updated warning copy, deletion succeeds, plan disappears from the list, and it no longer appears anywhere in Workout History.

## Review checklist
- [ ] `ConfirmDialog` is reused for both new confirms (Discard, plan-delete copy) rather than a new dialog component being invented.
- [ ]  All new API calls have error handling consistent with the rest of the file (see existing `catch (err: any) { setError(err.response?.data?.error || ...) }` pattern).
- [ ] TypeScript compiles with no new errors.
- [ ] No dead code left behind from the old single-button `handleExit` flow.
