# Task 81 — Make Plan Builder edit-mode mutations truly optimistic (update UI before the network call, not after)

## Objective
Task 79 removed the full-page reload from edit-mode mutations, but every handler still follows an "await the API, then patch local state" pattern — the UI doesn't change until the server responds. On a fast/local connection this is imperceptible; on mobile (extra network hop, often higher latency to the Railway-hosted backend), a two-call `Promise.all` (e.g. Add Set: `replaceSetTargets` + `updateExerciseInDay`) can take close to a second before the user sees anything happen, which reads as sluggish.

This task flips the order for the handlers listed below: apply the state update **synchronously, before** firing the API call(s), so the UI reflects the edit instantly regardless of network conditions. The API call still fires (to persist the change) but happens in the background. If it fails, the handler must **roll back** to the pre-edit state and surface an error — silently leaving an optimistic-but-wrong state on screen is worse than today's slower-but-correct behavior. A 401 is an exception to plain revert-and-toast — see the new client-level handling below.

Root cause / reference file: `frontend/src/features/workoutPlans/PlanBuilder.tsx`.

## New: app-wide 401 handling in `frontend/src/api/client.ts`

There is currently no handling anywhere in the app for an expired/invalid session — confirmed by reading `client.ts` (a bare `axios.create`, no interceptors) and grepping for `401`/`interceptors` across `features/auth/` and `api/` (no matches). Right now a 401 just surfaces as a generic error wherever it happens to occur. This becomes more visible once edits are optimistic (a background save silently failing over and over with no explanation is worse than today's blocking-but-visible failure), so fix it at the source rather than per-handler:

- Add a response interceptor in `frontend/src/api/client.ts` that, on any `401` response, clears the stored session — `localStorage.removeItem('auth_token')`, `localStorage.removeItem('current_user')`, `delete client.defaults.headers.common['Authorization']` (the same three things `AuthContext.tsx`'s `logout()` already does; duplicated here because this module has no access to React context) — and redirects to `/login` (`window.location.href = '/login'` is acceptable since this runs outside the React tree — a hard navigation is fine for a forced logout).
- This is an app-wide fix, not specific to `PlanBuilder.tsx` — it also correctly handles 401s from any other page's API calls, which today just show a raw error with no explanation.
- Once this is in place, the per-handler rollback-on-failure logic in `PlanBuilder.tsx` only needs to handle the non-401 case (network errors, validation errors, etc.) — a 401 never reaches the handler's own catch block once the interceptor's redirect fires first.
- New test (in a new or existing `client.test.ts`): mock a 401 response, assert `localStorage` is cleared and the redirect is triggered. Do not test this by asserting on `window.location.href` directly if the test environment makes that awkward — asserting the localStorage-clearing side effect is sufficient if a full navigation assertion isn't practical in the test setup; use judgment and note which approach was used in the completion report.

## Required changes

For each handler below, restructure the edit-mode (`else if (planId)`) branch to:
1. Capture the current value(s) needed for rollback (e.g. `const previousDays = draftDays;` / `const previousWeeks = draftWeeks;`, or just the specific field(s) being changed).
2. Apply the local state patch immediately (the exact patch logic already written for each handler by Task 79 — just move it before the API call instead of after).
3. Fire the API call(s) without blocking the state update on it.
4. On failure (`.catch` or `try/catch` around an `await` that now happens after the optimistic update), revert to the captured snapshot and call `setError(...)` / `showToast(..., 'error')` — follow whichever of the two this file already uses per-handler for consistency with its existing error handling.

Handlers to convert (all in `frontend/src/features/workoutPlans/PlanBuilder.tsx`):
- `handleUpdatePlanName` (~347) — `setDraftName`/`setIsRenamingPlan` immediately, then call `updateWorkoutPlan` in the background; revert `draftName` and reopen the rename UI on failure.
- `handleToggleRestDay` (~363) — patch `is_rest` immediately, then call `updateDay` in the background; revert on failure.
- `addExerciseToCurrentDay` edit-mode branch (~428) — this one is trickier: the new exercise doesn't have a real ID until `addExerciseToDay` returns one. Use a temporary negative ID (mirroring the pattern already used in the `props.isCreateMode` branch just above it) for the optimistic insert, then reconcile it with the real ID once the API responds; on failure, remove the optimistically-added exercise from local state.
- `handleUpdateExercise` (~599) — patch the field immediately, then call `updateExerciseInDay` in the background; revert the specific field on failure.
- `handleRemoveExercise` (~707) — remove from local state immediately, then call `removeExerciseFromDay` in the background; re-insert (at its original position) on failure.
- `handleUpdateSet` (~792) — this one already computes `updatedSets` synchronously before its existing 500ms-debounced API call; move the `setDraftDays`/`setDraftWeeks` patch to fire immediately (not inside the debounced timeout), and keep only the actual network call debounced. Revert to the pre-edit sets on failure.
- `handleAddSet` (~943) — patch `set_targets`/`target_sets` immediately (mirrors create-mode's existing instant behavior), then call `replaceSetTargets`/`updateExerciseInDay` in the background; revert (remove the added set) on failure.
- `handleRemoveSet` (~1055) — same pattern: remove immediately, background API calls, re-insert on failure.

## Do NOT
- Do **not** touch `handleCustomizeWeek` (~1169). This one was deliberately reverted in Task 79 to `await customizeWeek(...)` followed by `await loadPlanForEdit()`, because the backend assigns new day/exercise IDs on customize that the client cannot predict — a prior attempt to patch this one locally caused confirmed data corruption (editing the "customized" week silently wrote to the source week instead). It must keep waiting for the server and reloading. If you're unsure why, read the Task 79 dev-log entry and the git history on this handler before changing anything near it.
- Do not change `handleMatchPreviousWeek` (~1207) unless you can confirm (same due diligence as above) that its local patch (`mode: 'linked', days: []`) doesn't depend on server-assigned data — it's currently already optimistic-shaped in that it doesn't need the response, so converting it is optional/low-risk, but is not required for this task's acceptance criteria. If you do convert it, apply the same snapshot/rollback pattern as the others.
- Do not change any `props.isCreateMode` branches — they're already fully local/instant (no network call at all) and are unaffected by this task.
- Do not remove the 500ms debounce on `handleUpdateSet`'s network call — only change when the *local state update* happens (immediately) versus when the *API call* fires (still debounced, to avoid spamming the server on every keystroke).
- Do not change any backend code — this is frontend-only.

## Required tests
Per current testing policy, write new tests, not just confirm existing ones pass:
- A test that clicks "Add Set" in edit mode with the mutation API mocked to an unresolved/pending promise, and asserts the new set row appears in the DOM immediately (before the promise resolves) — the core proof this task exists to deliver.
- A test that toggles rest day (or another simple field) with the API mocked to reject, and asserts the UI reverts to the pre-toggle value and an error is shown — the rollback regression test.
- A test that removes a set with the API mocked to reject, and asserts the removed set reappears (rollback) rather than staying removed.
- At least one test for `addExerciseToCurrentDay`'s temporary-ID reconciliation: add an exercise in edit mode, assert it appears immediately with some ID, then assert after the mocked `addExerciseToDay` resolves that subsequent edits to that exercise use the real (resolved) ID, not the temporary one — this guards against a reconciliation bug that would silently break edits to a freshly-added exercise.

## Acceptance criteria
- [ ] Add Set, Remove Set, editing a set's reps/weight/duration, toggling has_reps/has_weight/has_duration/rest day, adding/removing an exercise, and renaming the plan all update the screen instantly, with no visible dependency on network round-trip time.
- [ ] If any of these API calls fail, the UI reverts to the pre-edit state and an error is shown — verified for at least the cases listed in Required tests.
- [ ] `handleCustomizeWeek` is untouched and still calls `loadPlanForEdit()` after `customizeWeek()` — confirm via diff that this function has zero changes.
- [ ] A freshly-added exercise (temporary ID during the optimistic window) can immediately have its fields/sets edited without waiting for the add to complete, and those edits correctly target the real exercise once the ID is reconciled.
- [ ] Full frontend test suite passes with the new tests included; `npx tsc -b` clean. Backend untouched.

## Review checklist
- [ ] Diff `handleCustomizeWeek` specifically and confirm it has zero changes — this is the one handler where "helpfully" applying the same pattern would reintroduce the Task 79 data-corruption bug.
- [ ] For each converted handler, confirm there's an actual rollback path on API failure, not just an optimistic update with no error handling.
- [ ] Live-verify on a throttled/mobile-simulated network (devtools network throttling) that Add Set and toggle interactions now feel instant, and that a forced failure (e.g. temporarily disconnect network mid-edit) visibly reverts rather than leaving a silently-desynced UI.
