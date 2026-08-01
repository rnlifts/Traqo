# Task 69 — Frontend: single-column mobile layout for Plan Builder

## Objective
Below the app's existing 768px breakpoint, reflow `PlanBuilder.tsx` from its current fixed two-column layout (main content + `320px` sidebar, always side-by-side regardless of viewport) into a single stacked column: preview panel → weeks → day tabs → exercise list → Exercise Library/Custom Exercises tabs → Save Plan. Desktop (≥768px) must remain **pixel-identical** to today. This is the same pattern as Task 68 (shell nav) and Task 66 (Active Workout preview modal) — this task is the third and largest piece of the ongoing Mobile Responsive work, and by far the riskiest given how many recent tasks (56-67) touched this exact file.

## Context — current structure (all in `frontend/src/features/workoutPlans/PlanBuilder.tsx`)
- Line 700: outer root — `<div style={{ display: 'flex', height: '100vh' }}>` — a hardcoded two-column flex row with **no mobile handling at all today**, unlike `ActiveWorkout.tsx` which already has `isMobile` state (Task 66).
- Line 704: header row (`display:flex`) containing the "← Back"/plan-name column on the left and `<ExercisePreviewPanel>` on the right (line 784).
- Line 1434-1435: the Exercise Library sidebar column, hardcoded `width: '320px'`, containing `<ExerciseLibrarySidebar>`.
- Between those: week rail (~line 794), day tabs (~line 853), and the exercise grid (`.exercise-row`, ~line 894 onward) — all currently rendered in the main content column, full width of whatever's left after the 320px sidebar is subtracted.
- **`ExercisePreviewPanel.tsx` (`frontend/src/components/ExercisePreviewPanel.tsx`) has a hardcoded inline `width: "300px"`** (JS style object, not a CSS class) — this was deliberately fixed this way earlier today to solve a real bug (it was collapsing to ~150px in a flex row with no defined width). **A plain CSS media-query override cannot beat this** since it's a React inline style, not a class rule — this needs an actual code change (e.g. a new prop like `fullWidth?: boolean`, or converting the width to a CSS class so a mobile media query can override it) for the panel to go full-width on mobile as in the reference mockup. Flagging this explicitly because it's exactly the kind of thing that's easy to miss and ship a broken-looking (still-300px) panel on mobile.
- Everything else in this file — `addExerciseToCurrentDay`, `handleQuickAddExercise`, `handlePreviewExercise` (~line 486), the day-row click-to-preview + scroll-to-top (~line 890-905, Task 60/62), the "Vary by set" per-set override panel, Save Plan, week rail linking/customizing — is real, working, independently-verified logic from Tasks 49-67. This task changes **layout/CSS only** — where things render and how they're sized — not what any of it does.

## Requirements

### 1. Preview panel goes full-width on mobile, placeholder-first (no auto-load)
- Below 768px, `ExercisePreviewPanel` renders at the top of the single column, full viewport width, instead of the compact `300px` box next to the plan name.
- Do **not** auto-select an exercise on page load — it must start in the existing placeholder state ("Click exercise to preview") exactly like today, both on mobile and desktop. The owner explicitly wants this (avoids loading a YouTube iframe on every page visit before the user's asked for it).
- Solve the fixed-`300px`-width problem (see Context) with whichever mechanism you judge cleanest — just don't use `!important` to fight the inline style, and don't remove the fixed-width behavior for desktop (that was a deliberate bug fix from earlier today).

### 2. Single-column reflow below 768px
- Order, top to bottom: preview panel → plan name/back button → week rail (if applicable) → day tabs → rest-day toggle → exercise list → "Save Plan" → Exercise Library/Custom Exercises tabs (search, muscle-group filter, results).
- The Exercise Library/Custom Exercises section (currently the fixed `320px` sidebar, line 1434-1435) moves to **below** the exercise list and Save Plan button in document order on mobile, matching the reference mockup — not beside it.
- Reuse the existing 768px breakpoint — do not introduce a new one, and do not change the value anywhere it's already used (`ActiveWorkout.tsx`, `App.css`, `Layout.tsx`).

### 3. Scroll-to-top behavior re-check
- The existing day-row click → scroll-to-top-of-page behavior (Task 62, ~line 890-905) was built for the desktop layout, where the preview panel sits at the very top of the scrollable content. On the new mobile single-column layout, confirm this still scrolls to a position where the (now full-width, still-at-the-top) preview panel is visible after clicking a day-row exercise. If the reflow changes where the panel sits in the DOM/scroll order, this needs to keep working, not just still compile.

## Do NOT
- **Do not change anything about desktop (≥768px) rendering, spacing, or behavior.** Verify with computed styles at a desktop viewport before/after, not just a visual glance.
- **Do not touch business logic.** No changes to `addExerciseToCurrentDay`, `handleQuickAddExercise`, `handlePreviewExercise`, week rail linking/customizing (`handleCustomizeWeek`, `handleMatchPreviousWeek`), "Vary by set" per-set override logic, Save Plan, or any API call — this task is CSS/layout/JSX-structure only.
- **Do not touch `ActiveWorkout.tsx`, `Layout.tsx`, `Modal.tsx`, `ExerciseWorkoutPreview.tsx`, or any backend file.** All independently verified and live in production as of today.
- **Do not modify `ExerciseLibrarySidebar.tsx`'s internal behavior** — its "+Add" stopPropagation fix (Task 60), thumbnail rendering, search, and tab switching are all working and independently verified; if it needs to render differently on mobile, that's a wrapping/layout change in `PlanBuilder.tsx`, not a rewrite of the sidebar component itself.
- Do not remove or weaken the existing placeholder-first (no autoplay, no auto-select) behavior of the preview panel.
- Do not change the 768px breakpoint value, or add a second, different mobile breakpoint for just this page.

## Acceptance criteria
- [ ] At ≥768px, layout and behavior are unchanged from today — verify with a side-by-side computed-style check, not just eyeballing.
- [ ] At <768px: single-column order matches the reference mockup (preview → weeks → days → exercises → Save Plan → library), preview panel is full-width and starts in placeholder state.
- [ ] Clicking a day-row exercise still previews it and scrolls to a position where the panel is visible, on both mobile and desktop.
- [ ] All existing Plan Builder functionality (add/remove/edit exercises, week linking, vary-by-set, save) works identically on mobile — verify live, not just "it still compiles."
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify at a real mobile width (~375-414px) with a screenshot, matching against the reference mockup's general structure (not pixel-perfect, but same section order and full-width video).
- [ ] Confirm the preview panel does NOT show a stale/broken `300px`-wide box on mobile — check its actual rendered width via computed styles, the same class of bug caught earlier today in `ExercisePreviewPanel`'s desktop sizing.
- [ ] Re-run the exact regression checks from Tasks 60 and 62 on mobile specifically: click "+ Add" and confirm it does NOT also trigger a preview change; click a day-row and confirm the scroll-to-top genuinely brings the panel into view.
- [ ] Confirm desktop is untouched with a fresh-tab, side-by-side check — this file has been modified in nearly every task from 56-62, so regression risk here is higher than a typical task.
