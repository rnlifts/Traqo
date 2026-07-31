# Task 65 — Frontend: wire thumbnails + preview side panel into Active Workout (desktop)

## Objective
Add a thumbnail to each exercise card in `ActiveWorkout.tsx`, and wire `ExerciseWorkoutPreview` (Task 64) into a persistent side panel — clicking a card's thumbnail/name selects that exercise for preview, independent of whether its set-logging inputs are currently open. Desktop/wide-viewport layout only; the mobile modal variant is Task 66. Depends on Tasks 63 and 64.

## Context
- `frontend/src/features/sessions/ActiveWorkout.tsx` (1390 lines). Confirmed exact current structure:
  - Local `WorkoutExercise` interface (lines 20-35) does **not** have `video_url`, `muscle_group`, or `equipment` — these need to be added to this interface (matching the field names/types from Task 63's backend change and the existing `video_url?: string | null` pattern already on `frontend/src/api/workoutPlansApi.ts:29`'s `WorkoutExercise` type). Since `planExercises` is passed in as a prop from `ActiveWorkoutPage.tsx` (which already calls `getWorkoutPlanDetail`, the same endpoint Task 56/63 extend), the real data will already be flowing in once the type is widened — confirm this live, don't assume.
  - `activePanelExerciseId` state: declared line 95, toggled via `openSetPanel()` (line 256, sets to `null` at line 260 if re-tapping the same open exercise, sets to the tapped exercise at line 266) and cleared at line 333. **Do not reuse this state for the preview selection** — per the owner's explicit direction, preview selection must be independent of whether the set-logging panel is open (a user should be able to preview an exercise without opening its inputs). Add a new, separate state (e.g. `previewingExerciseId: number | null`).
  - Main render return starts line 590 (loading-branch) and the primary one—confirm the real one after Task 63/64 land, structure may have shifted slightly by the time you start; re-grep rather than trusting these exact numbers if drift has occurred.
  - Exercise cards render inside a single-column CSS grid (line 811: `<div style={{ display: "grid", gap: "20px", marginBottom: "20px" }}>`), looping at line 817 (`planExercises.map((we) => {`), each card starting line 826 (`<div key={we.id} className="card" style={{ padding: "12px" }}>`) with `<h3>{exerciseName}</h3>` immediately after (line 828).
  - Pips row follows after target/previous/notes lines (~lines 830-864), starting ~line 866 — do not touch pip styling/behavior in this task, that's Task 67.

## Requirements

### 1. Widen the `WorkoutExercise` interface
- Add `video_url?: string | null; muscle_group?: string | null; equipment?: string | null;` to the local interface (lines 20-35), matching Task 63's backend field names exactly.

### 2. Thumbnail on each exercise card
- Next to `<h3>{exerciseName}</h3>` (line 828), add a small thumbnail (~40px, same size/style as the Plan Builder day-row thumbnails from Task 59) using `getYoutubeThumbnailUrl(we.video_url)` from `utils/youtube.ts`, with the same 🏋️ fallback icon convention used elsewhere when there's no thumbnail.
- The thumbnail (and the exercise name text next to it) is the click target for preview selection — clicking it sets `previewingExerciseId` to `we.id`. This must be a distinct click target from the pips, from any input, and from the existing `openSetPanel` trigger — clicking to preview must not also open or close the set-logging panel, and vice versa.

### 3. Desktop side panel
- Render `ExerciseWorkoutPreview` (Task 64) in a persistent side column next to the exercise-card list, showing whichever exercise's `id` matches `previewingExerciseId` (look it up from `planExercises`), or a placeholder state if nothing is selected yet (mirror `ExercisePreviewPanel`'s "click to preview" placeholder pattern for consistency, but this is a separate component per Task 64 — implement its own placeholder, don't try to reuse `ExercisePreviewPanel`'s JSX directly).
- This requires restructuring the current single-column layout (line 590 wrapper, line 811 grid) into a two-column layout (cards column + side panel column) for desktop/wide viewports. The exact split (column widths, gap) is a judgment call — check `PlanBuilder.tsx`'s two-column layout (main content `flex: 1` + `320px` sidebar) for a consistent precedent in this app, but Active Workout doesn't need to match it exactly since the content is different.
- This task is desktop-only — at this point it's fine (and expected) if the two-column layout looks cramped or wrong on a narrow viewport; Task 66 handles the breakpoint where this collapses into a modal-triggered mobile treatment instead.

## Do NOT
- Do not touch pip rendering/styling (Task 67, separate).
- Do not reuse `activePanelExerciseId` for preview selection — they must be independent, per the owner's explicit requirement (preview an exercise without needing to open its set-logging inputs).
- Do not build the mobile/modal path in this task — desktop side panel only. Verify at a normal desktop viewport width; a cramped mobile view at this stage is expected and not a bug to fix here.

## Acceptance criteria
- [ ] Every exercise card shows a thumbnail (or 🏋️ fallback) next to its name.
- [ ] Clicking a card's thumbnail/name sets that exercise as the preview selection, updating the side panel, without opening or closing that exercise's set-logging panel.
- [ ] Opening a set-logging panel (existing pip-tap behavior) does not change the preview selection.
- [ ] The side panel shows the correct video + name + tags for whichever exercise was last clicked for preview, and a sensible placeholder before anything's been clicked.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify (real browser, real session) that clicking a thumbnail while a *different* exercise's set-logging panel is open does not disturb that open panel, and vice versa — this is the core "independent state" requirement and the easiest thing to get subtly wrong.
- [ ] Confirm `planExercises` genuinely carries real `video_url`/`muscle_group`/`equipment` values at runtime (not just that the TypeScript type says it should) — check via the browser, not just a type-checker pass.
