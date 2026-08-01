# Task 72 — Frontend (both desktop and mobile): replace "Vary by set" with a collapsible, one-at-a-time set builder

## Objective
Replace the current "type a Sets number, optionally click Vary by set to override individual sets" model in Plan Builder with a "build sets one at a time" model: every exercise starts with exactly Set 1, an explicit "+ Add Set" button appends a new set pre-filled from the previous set's values, and each set renders as a collapsible row (compact one-line summary; tap to expand into editable fields, laid out horizontally rather than each stacked full-width). Applies to **both** desktop and mobile — unlike the last several tasks, this is not mobile-only.

## Critical cross-cutting constraint — read this before touching anything
**`ActiveWorkout.tsx` reads the exact data this screen writes, and must not be touched by this task.** Specifically:
- `target_sets` (used for pip count — `getPipCount`/similar logic in `ActiveWorkout.tsx`)
- `set_targets[]` (used to pre-fill each pip's target reps/weight/duration)
- `has_reps` / `has_weight` / `has_duration` (used to decide which fields a pip's logging panel shows)

This task changes **how the user enters this data** in Plan Builder, not the shape of the data itself. `target_sets` must still end up being the correct integer (now derived from the count of sets the user built, instead of manually typed), `set_targets` must still be a correctly-ordered, correctly-numbered array, and `has_reps`/`has_weight`/`has_duration` keep their existing meaning (exercise-level toggles — see below, not per-set). If Active Workout's existing tests still pass unmodified after this change and a real "add exercise → build 3 sets → start workout" walkthrough shows the right pips with the right pre-filled values, you've kept the contract intact. If you find yourself wanting to change `ActiveWorkout.tsx` to make this work, stop and flag it — that means the data shape has drifted, which is the one thing this task must not do.

## Context — exact current implementation in `frontend/src/features/workoutPlans/PlanBuilder.tsx`
- Lines 131-136: `varyBySetRows` (Set of exercise IDs currently in "vary by set" mode), `perSetEditsByExerciseId` (Map of exercise ID → array of per-set edits), `savingSetTargets`/`savedSetTargets` (save-button UI state). **All four of these are being replaced/repurposed** by this task's new collapsible-set-list model — they don't need to survive in their current form, but understand what they did before removing them.
- Lines 985-997: the standalone "Sets" number input (`ex.target_sets`) at the top of each exercise row. **This input goes away** — set count becomes the length of the set list the user builds, not something separately typed.
- Lines 1166-1228: the "Vary by set" button and "Remove exercise" button (`row-actions`). **"Vary by set" button is fully removed** per your decision; replace it with the new set-builder UI (see Requirements). "Remove exercise" (deletes the whole exercise from the day) is unrelated and must be preserved exactly as-is.
- Lines 1231-1370: the existing "Per-Set Overrides" panel (`set-detail-panel`) — shows one row per set with Reps/Weight/Duration inputs side-by-side already (this part's horizontal layout is a reasonable starting point to adapt), plus the manual "Save set targets" button (lines 1298-1368, with a `savingSetTargets`/`savedSetTargets` two-stage UI and, in edit mode, an explicit `replaceSetTargets(planId, currentDay.id, ex.id, perSetEdits)` API call followed by `loadPlanForEdit()`).
- `replaceSetTargets` (imported line 13) is the existing API call for persisting a set-targets array in edit mode — reuse it, don't build a new endpoint or bypass it.
- `handleUpdateExercise(exerciseId, field, value)` — the existing function that updates a single exercise-level field (used today for `has_reps`/`has_weight`/`has_duration` toggles, `notes`, and the old `target_sets`/`target_reps`/`target_weight` inputs). Exercise-level toggles (`has_reps`/`has_weight`/`has_duration`) and `notes` stay exercise-level, not per-set — this task does not make notes or the has-X toggles vary per set, only the actual reps/weight/duration target values vary per set (this already matches how `set_targets` works today, just confirming it explicitly: don't expand scope to per-set notes or per-set has-X toggles, that's not what was asked).
- Create-mode (`props.isCreateMode`) vs. edit-mode (`planId`) already branch throughout this file — in create mode, nothing hits the API until "Save Plan"; in edit mode, changes call real endpoints and reload. The new set-builder must respect this same split (don't make create-mode suddenly call APIs, don't leave edit-mode changes unsaved).

## Complete user use case
1. User adds an exercise to a day (via the existing add flow — Task 70's modal on mobile, sidebar on desktop; this part is unchanged). The exercise appears with exactly **Set 1**, pre-filled from whatever default reps/weight/duration values exist (or empty if none).
2. Set 1 renders as a **collapsible row**: collapsed by default shows a compact one-line summary (e.g. "Set 1 · 135 lbs × 10 reps", or "Set 1 · not set" if empty) with a clear expand affordance (chevron/tap target). Tapping it expands to show the actual editable Reps/Weight/Duration inputs (whichever are enabled via the exercise-level `has_reps`/`has_weight`/`has_duration` toggles), laid out **horizontally** — this is also the fix for the "taking too much space" complaint from the vertical-stacked layout in the current design.
3. User taps **"+ Add Set"**. A new Set 2 appears, **pre-filled by copying Set 1's current reps/weight/duration values** (a one-time copy-as-starting-point, not a live link — editing Set 2 afterward doesn't affect Set 1 and vice versa). Set 2 respects the same exercise-level `has_reps`/`has_weight`/`has_duration` configuration as Set 1 (there's only one such configuration per exercise, so this is automatic, not something to implement per-set).
4. User can expand/collapse each set independently, edit any set's values, and tap "+ Add Set" again for Set 3, Set 4, etc. — each new one pre-filled from whichever set was previously last in the list.
5. Each set (when more than one exists) has a way to remove it; removing a set renumbers subsequent sets down by one (e.g. removing Set 2 out of Set 1/2/3 leaves Set 1/2, with old Set 3 renumbered to Set 2). An exercise cannot go below 1 set — if only Set 1 remains, there's no remove control for it (or it's disabled), since an exercise with zero sets doesn't make sense here.
6. Saving: in edit mode, persist the current set list via the existing `replaceSetTargets` API — you can trigger this automatically (e.g. on each add/edit/remove, possibly debounced) or keep an explicit save affordance; either is acceptable, but be consistent and don't leave a state where the user has to remember to click "Save" somewhere non-obvious to avoid losing set edits. In create mode, keep the existing draft-only behavior (no API call until "Save Plan").
7. This must work identically in structure on both desktop and mobile — the exact pixel layout can differ (mobile narrower, desktop can afford more horizontal room per row), but the interaction model (collapsible sets, "+ Add Set", pre-fill-from-previous) is the same on both.

## Requirements
1. Remove the standalone "Sets" number input (lines 985-997) — set count is now derived from the set list length, never manually typed.
2. Remove the "Vary by set" button and its associated mode toggle entirely.
3. Build the new collapsible set-list UI: default 1 set, "+ Add Set" appends with copy-from-previous pre-fill, per-set collapse/expand, per-set remove (except when only 1 set remains), horizontal field layout when expanded.
4. Wire saving correctly for both create-mode (draft-only) and edit-mode (real `replaceSetTargets` calls) — see the save-timing note above; document whichever choice you make so the review pass knows what to check.
5. Ensure `target_sets` is correctly derived and sent as part of whatever payload the backend expects (check how `target_sets` is currently included in `addExerciseToDay`/`updateExerciseInDay`/`buildPlan` calls and make sure the new derived count flows through the same paths — don't leave `target_sets` stale or unset).
6. Both desktop and mobile get this new interaction model — no `isMobile` branching needed for this task **unless** the exact visual layout genuinely needs to differ (e.g. how many fields fit per row before wrapping) — the interaction logic (data model, add/remove/pre-fill) should be identical code, not duplicated per platform.

## Do NOT
- Do not touch `ActiveWorkout.tsx` — see the critical constraint above. If existing Active Workout tests break after this change, that's a sign this task went out of scope, not a sign to go fix that file.
- Do not touch the backend — `target_sets`, `set_targets`, `has_reps`/`has_weight`/`has_duration` all already exist and are already writable via existing endpoints (`replaceSetTargets`, `addExerciseToDay`, `updateExerciseInDay`, `buildPlan`). This is a frontend interaction redesign only.
- Do not make `has_reps`/`has_weight`/`has_duration` or `notes` per-set — they stay exercise-level, exactly as today. Only the actual target reps/weight/duration *values* vary per set.
- Do not change "Remove exercise" (deleting the whole exercise from the day) — unrelated to this task, must keep working exactly as-is.
- Do not touch Tasks 68-71's mobile nav/picker-modal/preview-modal work in this file — this task adds a new UI section within the exercise row, it doesn't need to touch the picker or preview modal code at all.
- Do not make "+ Add Set" or any part of this new UI trigger a preview or interfere with the existing day-row click-to-preview behavior (Task 60/71) — confirm the new set-builder's own click targets have `stopPropagation()` where needed, matching the existing pattern already used throughout this row (see how `onClick={(e) => e.stopPropagation()}` is used on every existing input/button in this row today).

## Acceptance criteria
- [ ] New exercise starts with exactly Set 1, no manual "Sets" number field anywhere.
- [ ] "+ Add Set" appends a new set pre-filled from the previous set's values; editing the new set doesn't retroactively change the one it was copied from.
- [ ] Each set collapses to a compact one-line summary and expands to horizontal editable fields on tap.
- [ ] Removing a set renumbers subsequent sets; can't remove the last remaining set.
- [ ] Works identically (same interaction model) on both a real desktop width and a real mobile width.
- [ ] Edit-mode changes actually persist (verify via reload, not just optimistic UI) using the existing `replaceSetTargets` call; create-mode stays draft-only until "Save Plan".
- [ ] A full "Plan Builder → Active Workout" walkthrough (add exercise, build 3 sets with different values, save plan, start the workout) shows the correct pip count and correct per-pip pre-filled values in `ActiveWorkout.tsx`, unmodified.
- [ ] Full frontend test suite passes (including all of `ActiveWorkout.test.tsx` and `PlanBuilder.test.tsx` unmodified in their assertions about Active Workout's own behavior); `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify the full cross-screen walkthrough described in the last acceptance criterion — this is the one thing that can't be caught by only testing Plan Builder in isolation.
- [ ] Confirm on a real mobile width that expanded sets don't overflow or get clipped, and the horizontal field layout genuinely reads as more compact than today's stacked version (screenshot comparison).
- [ ] Confirm on desktop that nothing regressed relative to before this task, apart from the deliberate interaction-model change itself.
- [ ] Confirm existing day-row click-to-preview (Task 60/71) still works and isn't accidentally triggered by clicks inside the new set-builder UI.
- [ ] Re-read the save-timing choice made for Requirement 4 and confirm it doesn't silently lose edits (e.g. navigating away mid-edit in edit-mode) — spell out in the completion report which approach was taken.
