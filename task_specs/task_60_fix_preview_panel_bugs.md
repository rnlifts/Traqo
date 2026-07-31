# Task 60 — Frontend: fix 3 confirmed bugs in Task 59's preview panel wiring

## Objective
Task 59 (preview panel wired into Plan Builder) shipped with three confirmed bugs, found via independent code review and live browser reproduction. This task fixes all three. No new features, no scope beyond what's listed below.

## Context
Verified directly (code read + live reproduction in browser, not just review) against `frontend/src/features/workoutPlans/PlanBuilder.tsx` and `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx`.

## Bugs to fix

### Bug 1 — day-row video_url is dropped when building a new (unsaved) plan
In `PlanBuilder.tsx`, `addExerciseToCurrentDay()` (~line 367), the `isCreateMode` branch builds a draft `WorkoutExercise` object (~lines 415-430) that is pushed straight into `draftDays`/`draftWeeks` state. This object never sets `video_url`, even though `exerciseInfo.video_url` is available in scope (it's already used two lines earlier, at line 399, when creating the personal exercise via `exercisesApi.create`).

Effect, reproduced live: add any library exercise with a real YouTube URL (e.g. "Cable Flye") to a brand-new plan that hasn't been saved yet. The day-row shows the 🏋️ fallback icon instead of a thumbnail, and clicking that row for preview shows "No preview available" — even though the exercise genuinely has a video. This only works correctly today when editing an already-saved plan (where `loadPlanForEdit()` re-fetches from the backend, which does include `video_url` since Task 56). Since "build a new plan" is the primary flow through this page, this defeats the row-thumbnail and third preview source for most real usage.

**Fix**: add `video_url: exerciseInfo.video_url || null,` to the draft `newExercise` object construction (~line 415-430), matching the field already present on the `WorkoutExercise` type (`frontend/src/api/workoutPlansApi.ts:29`).

### Bug 2 — clicking "+ Add" (and other row controls) also fires the preview handler
Neither `ExerciseLibrarySidebar.tsx`'s result rows (Exercise Library tab ~line 381-388, Custom Exercises tab ~line 534) nor `PlanBuilder.tsx`'s day-exercise-row (~line 885-890) call `stopPropagation()` on their nested interactive children. The outer row `div` in each case carries the preview `onClick`, so any click inside it — the "+ Add" button in the sidebar, or the Delete button / "Vary by set" button / Sets / Reps / Weight / Duration / Notes inputs in the day row — bubbles up and also triggers `onPreviewExercise` / `handlePreviewExercise`.

Reproduced live: clicking "+ Add" for "Cable Flye" in the Exercise Library tab also populated the preview panel with Cable Flye, as an unintended side effect of the click bubbling.

This isn't data-destructive (adding/deleting/editing still works correctly underneath), but it violates the Task 59 spec's own review checklist ("Confirm clicking a row for preview doesn't interfere with clicking '+ Add', 'Edit', 'Delete', or any of the day-row's own inputs") and produces a jarring UX where the preview panel changes every time you type in an unrelated field or click Delete.

**Fix**: in each of the following, stop the click from bubbling to the row's own preview `onClick`:
- `ExerciseLibrarySidebar.tsx`: the "+ Add" button in the Exercise Library tab (~line 454-460) and in the Custom Exercises tab (~line 607).
- `PlanBuilder.tsx`: the Sets input, Reps input/badge/chip, Weight input/badge, Duration control, Notes field, "Vary by set" button, and the Delete/trash button inside `.exercise-row` (~lines 935-1154).

Use `e.stopPropagation()` inside each handler (or on the wrapping container of the controls block, whichever is cleaner given the existing structure) — do not restructure the row markup beyond what's needed to stop propagation.

### Bug 3 — day-row click-to-preview has zero test coverage
`PlanBuilder.test.tsx` mocks `ExerciseLibrarySidebar` away entirely and only tests two of the three required preview sources (Library tab, Custom tab via the mock's fake buttons). It never tests clicking an exercise already in the day's own list — the exact source where Bug 1 lived, which is why Bug 1 shipped despite the Task 59 completion report claiming "Day-exercise rows (click to preview)" was implemented and tested.

**Fix**: add a test to `PlanBuilder.test.tsx` that adds/renders an exercise in the day list (with a `video_url`) and clicks its row, asserting the preview panel updates to that exercise's name. This does not need to mock `ExerciseLibrarySidebar` differently — it's testing the day-row click handler directly, which lives in `PlanBuilder.tsx` itself.

## Do NOT
- Do not touch the preview panel's own component (`ExercisePreviewPanel.tsx`) or `utils/youtube.ts` — both are already verified correct.
- Do not change what "+ Add" does functionally (it should still add to the plan) — only stop it from also changing the preview selection as a side effect.
- Do not add debouncing, confirmation dialogs, or any other new behavior beyond stopping propagation and fixing the missing field.
- Do not touch `ActiveWorkout.tsx` — out of scope, per Task 59's original spec.

## Acceptance criteria
- [ ] Add any library exercise to a brand-new, unsaved plan; its day-row shows a real thumbnail (not the fallback icon) and clicking the row shows the real preview with a working play button.
- [ ] Clicking "+ Add" in either sidebar tab does NOT change the preview panel's current selection (unless the row was already the one selected).
- [ ] Clicking Delete, "Vary by set", or typing in any of the day-row's inputs does NOT change the preview panel's current selection.
- [ ] All previously-passing tests still pass; a new test covers day-row click-to-preview.
- [ ] Full frontend test suite passes (`npm test`) and `npx tsc -b` is clean (not `tsc --noEmit` — that command is a known no-op on this project's tsconfig).

## Review checklist
- [ ] Live-verify Bug 1's fix specifically in create-mode (new, unsaved plan) — not edit-mode, since edit-mode was already working and could mask a regression check.
- [ ] Live-verify Bug 2's fix by clicking "+ Add" and confirming the preview panel does NOT change (unless that exercise was already selected).
- [ ] Confirm the new test in `PlanBuilder.test.tsx` actually fails if Bug 1's fix is reverted (i.e. it isn't a false-positive/unfalsifiable test) — this project has repeatedly caught fake tests that pass regardless of whether the feature works.
