# Task 66 — Frontend: mobile modal variant for the Active Workout preview (<768px)

## Objective
Below the app's existing 768px breakpoint, replace the persistent side panel (Task 65) with the new `Modal` component (Task 64) — the same thumbnail/name click that sets `previewingExerciseId` opens a dismissible modal containing `ExerciseWorkoutPreview`, instead of updating a side column that has no room to exist on a narrow screen. Depends on Tasks 64 and 65.

## Context
- `frontend/src/App.css:134` — the app's one existing responsive breakpoint (`@media (max-width: 768px)`), used today for the main nav sidebar collapsing into a hamburger/topbar (`.mobile-topbar`, `.hamburger-btn`). Follow this same 768px breakpoint for consistency — don't introduce a different cutoff.
- Confirmed via search: there is **no existing responsive treatment specific to `ActiveWorkout.tsx`** (no `.card` or active-workout-scoped rules inside the 768px block) — this is the first mobile-specific work on this screen, not an adjustment to something already there.
- The same `previewingExerciseId` state and click target (thumbnail/name on each card, from Task 65) drives both the desktop side panel and this modal — do not add a second, separate state or a second click handler. The only thing that changes at the breakpoint is *where* `ExerciseWorkoutPreview` renders (side panel vs. inside `Modal`), not how selection happens.

## Requirements
- Below 768px width: do not render the Task 65 side panel column at all (it has nowhere to go on a phone-width screen) — instead, when `previewingExerciseId` is set (by the same thumbnail/name click as desktop), open the `Modal` (Task 64) with `ExerciseWorkoutPreview` for that exercise as its content.
- Closing the modal (backdrop click, close button) should clear or leave `previewingExerciseId` as-is per your judgment — either is acceptable UX (re-tapping the thumbnail should always reliably reopen the modal for that exercise either way), but be consistent and don't leave the modal in a state where it can't be reopened.
- Use a CSS media query (matching the existing 768px convention) or a `window.matchMedia`/resize-listener approach, whichever fits this component more cleanly given how the rest of the file is structured — your call, but don't hardcode a fixed viewport assumption that breaks if the window is resized while the page is open (e.g. rotating a tablet, or resizing a desktop browser window down).
- Thumbnails on each card (Task 65) remain visible and are the same click target on mobile — no change there, only the destination of the click changes at the breakpoint.

## Do NOT
- Do not change pip behavior/styling (Task 67).
- Do not introduce a new breakpoint value — reuse 768px for consistency with the rest of the app.
- Do not duplicate the preview-selection state or click handler — one state, one handler, two render destinations depending on viewport.

## Acceptance criteria
- [ ] At a viewport ≥768px, behavior is unchanged from Task 65 (side panel, no modal).
- [ ] At a viewport <768px, clicking a thumbnail/name opens the modal with the correct exercise's video/name/tags, and the side panel is not rendered at all.
- [ ] Resizing the browser window across the 768px boundary while the app is open doesn't leave it in a broken state (e.g. modal stuck open with no way to close, or side panel and modal both rendering at once).
- [ ] Full frontend test suite passes (including a test at a mocked narrow viewport, if this project's test setup supports that — check existing tests for a precedent before inventing a new mocking approach); `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify using the browser's actual responsive/device-width tools (not just guessing from code) at both a real desktop width and a real ~375-414px mobile width — resize the browser and re-check, per this project's established discipline that layout/responsive work must be seen, not just read.
- [ ] Confirm the modal is genuinely dismissible on a real mobile-width viewport (backdrop tap and close button both work) and that dismissing it and re-tapping the thumbnail reliably reopens it for the same or a different exercise.
