# Task 79 — Replace full-page reload with optimistic local updates in Plan Builder edit mode

## Objective
In edit mode, `PlanBuilder.tsx` currently follows *every* mutation (rename plan, toggle rest day, add/remove exercise, update any exercise field or toggle, add/remove/edit a set, customize/match week) with `await loadPlanForEdit()`. That function sets a page-wide `loading` flag, which causes the entire component — including the day-tab bar — to unmount and get replaced by a full-screen "Loading plan builder..." spinner, then re-fetches both `GET /workout-plans/{id}` and `GET /exercises` before restoring the page.

This means a single keystroke in a set's reps field (after its 500ms debounce) or a single toggle tap blanks the whole screen and does two sequential network round-trips, discarding the fact that every mutation endpoint (`addExerciseToDay`, `updateExerciseInDay`, `removeExerciseFromDay`, `replaceSetTargets`, `updateDay`, `updateWorkoutPlan`, `customizeWeek`, `matchPreviousWeek`) already returns the updated data needed to patch local state directly. On mobile this is especially disruptive: users often tap to switch day tabs right after editing a field, and the debounced/immediate reload lands mid-navigation, making the tab bar itself flash away — this reads as "switching tabs causes loading," but the real cause is the reload triggered by the preceding edit.

Root cause file: `frontend/src/features/workoutPlans/PlanBuilder.tsx`. Create mode already updates `draftDays`/`draftWeeks` in-memory without hitting the server at all (see the `props.isCreateMode` branches throughout) — edit mode should use the same local-state-patching approach, using the API response instead of a synthesized object.

## Required changes

Replace `await loadPlanForEdit()` in each edit-mode handler with a targeted update to `draftDays` (or `draftWeeks`, mirroring the existing `draftUnitType === 'days' ? ... : ...` branching already used in every create-mode branch in this file). Do not remove `loadPlanForEdit()` itself — it's still needed for the initial page load ([PlanBuilder.tsx:158-166](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) and can stay as a manual fallback for `handleUpdatePlanName`'s current call site if a full resync is genuinely needed there (rename doesn't affect day/exercise/set state, so it likely doesn't need a resync at all — just `setDraftName`/`setIsRenamingPlan`, no reload).

Specifically, in `frontend/src/features/workoutPlans/PlanBuilder.tsx`:

- **`handleUpdatePlanName`** ([:347](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — after `updateWorkoutPlan`, just `setDraftName(renamePlanName)` and close the rename UI. Remove the `await loadPlanForEdit()` call — nothing else on the page depends on the plan name.
- **`handleToggleRestDay`** ([:394-403](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — `updateDay` returns the updated day; patch `currentDay.is_rest` in `draftDays`/`draftWeeks` locally instead of reloading, the same way the `props.isCreateMode` branch just above it already does.
- **`addExerciseToCurrentDay`** edit-mode branch ([:500-506](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — `addExerciseToDay` already returns `created` (used for `setExpandedExerciseIds`). Append `created` to the current day's `exercises` array locally instead of calling `loadPlanForEdit()`.
- **`handleUpdateExercise`** edit-mode branch ([:606-624](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — `updateExerciseInDay` returns the updated exercise; patch it into `draftDays`/`draftWeeks` by `exerciseId` instead of reloading.
- **`handleRemoveExercise`** edit-mode branch ([:660-669](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — on success, filter the exercise out of local state (mirrors the create-mode branch immediately above it) instead of reloading.
- **`handleUpdateSet`** edit-mode branch ([:774-799](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — the debounced save already computes `updatedSets` and `exerciseUpdates` before calling the API. After `Promise.all([replaceSetTargets(...), updateExerciseInDay(...)])` resolves, patch `set_targets`/`target_sets` (and `target_reps`/`target_weight`/`target_duration_seconds` if `setNumber === 1`) into local state directly — the values are already known locally (`updatedSets`, `exerciseUpdates`), no need to even read the response. Remove `await loadPlanForEdit()`.
- **`handleAddSet`** edit-mode branch ([:865-876](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — same pattern: `updatedSets` is already computed locally before the API call; patch it into state after the `Promise.all` resolves instead of reloading.
- **`handleRemoveSet`** edit-mode branch ([:945-956](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — same pattern as `handleAddSet`.
- **`handleCustomizeWeek`** edit-mode branch ([:984-992](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — `customizeWeek` returns the updated week; patch `draftWeeks[activeWeekIndex]` locally instead of reloading. If the API response doesn't include full day/exercise data needed for local patching, that's acceptable to leave as a `loadPlanForEdit()` call — call this out explicitly in the completion report rather than silently reloading.
- **`handleMatchPreviousWeek`** edit-mode branch ([:1010-1022](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — same as above: patch locally (`mode: 'linked', days: []`, mirroring the create-mode branch) if the API response supports it, otherwise flag it rather than silently keeping the reload.

Also: `loadExercises()` is called at the end of `loadPlanForEdit()` ([:187](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) purely to refresh `availableExercises`. Since edit-mode handlers will no longer call `loadPlanForEdit()`, this refetch of the full exercise list on every mutation goes away automatically as a side effect — confirm this in review (the exercise list only needs to refresh when a *new* exercise is created, which is already handled separately via `handleExerciseCreated`).

## Do NOT
- Do not touch anything in `props.isCreateMode` branches — those already work correctly via local state and are the reference pattern to copy for edit mode.
- Do not remove `loadPlanForEdit()` itself or the initial-load `useEffect` ([:158-166](../frontend/src/features/workoutPlans/PlanBuilder.tsx)) — first page load still needs a real fetch.
- Do not change the `loading` state's initial-load behavior (full-page spinner on first load is fine and expected) — only remove the *repeated* `setLoading(true)` triggered by every edit.
- Do not change any backend code — the mutation endpoints already return sufficient data; this is a frontend-only fix. If while implementing you find an endpoint's response is missing a field needed for local patching (e.g. `customizeWeek`/`matchPreviousWeek` not returning full nested day/exercise data), do not silently keep calling `loadPlanForEdit()` for that one handler without saying so — flag it explicitly in the completion report as a known remaining gap.
- Do not change the 500ms debounce behavior on `handleUpdateSet` — only what happens after the debounced save completes.

## Required tests
Per current testing policy, write new tests covering this fix, not just "existing tests pass":
- A test that edits a set's reps/weight value in edit mode (mock the API resolve) and asserts `client`/`updateExerciseInDay`/`replaceSetTargets` mocks are called, but the page does **not** re-enter a loading state afterward (e.g. assert the day-tab bar / exercise list remains in the DOM continuously, or that `workoutPlansApi.getWorkoutPlan` / the plan-detail GET is only called once — on initial mount — not again after the edit).
- A test that toggles `has_reps`/`has_weight` off and back on in edit mode and asserts the toggle reflects immediately without an intervening full-page loading state.
- A test that adds and then removes a set in edit mode, asserting the set list updates locally and no second full-plan fetch occurs.
- At least one regression test that would have caught the original bug: assert the plan-detail fetch (`client.get` on `/workout-plans/{id}` or equivalent, per how it's currently mocked in `PlanBuilder.test.tsx`) is called exactly once across a sequence of several edits in edit mode.
- If backend responses turn out insufficient for any single handler (see the customize/match-week caveat above) and that handler is left calling `loadPlanForEdit()`, write a test asserting that *that specific* handler still reloads correctly — don't leave it untested just because it's the exception.

## Acceptance criteria
- [ ] In edit mode, editing a set's reps/weight/duration does not trigger a full-page "Loading plan builder..." state — only the two mutation network calls fire, no plan-detail or exercise-list GET.
- [ ] Toggling has_reps/has_weight/has_duration, editing notes, adding/removing a set, adding/removing an exercise, and toggling rest day all update the UI immediately from the mutation response / already-known local values, without a page-wide loading flash.
- [ ] Renaming the plan updates the header immediately without a reload.
- [ ] Switching day tabs immediately after an edit no longer shows the tab bar disappear/reappear.
- [ ] `expandedExerciseIds` state (which set/exercise cards are expanded) is preserved across edits — it already should be, since it's independent state, but confirm no regression now that reload calls are removed.
- [ ] Full frontend test suite passes with the new tests included; `npx tsc -b` clean. Backend untouched — backend test suite should be unaffected (confirm zero backend file diffs).

## Review checklist
- [ ] Diff should touch only `frontend/src/features/workoutPlans/PlanBuilder.tsx` and `PlanBuilder.test.tsx` (or a new test file) — no backend files, no other frontend files.
- [ ] For each edit-mode handler listed above, confirm `loadPlanForEdit()` was actually removed and replaced with local state patching — not just left in place alongside new code.
- [ ] Live-verify in the browser (throttle network in devtools to simulate mobile) that rapid edit-then-switch-tab no longer shows a loading flash.
- [ ] Confirm the "known gap" callout (if any) for `customizeWeek`/`matchPreviousWeek` is explicit in the completion report, not silently left as a reload with no explanation.
