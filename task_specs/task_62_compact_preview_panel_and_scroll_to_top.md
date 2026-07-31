# Task 62 — Frontend: make the preview panel compact + auto-scroll to it on click

## Objective
Two owner-reported UX problems with the preview panel added in Tasks 58-60:
1. The panel is too large — it currently renders full-width across the main content column, forcing a big 16:9 video box into the page. Owner wants a small, compact preview box positioned near the top of the page, over on the right-hand side (in the same general area as the Exercise Library sidebar), not stretched across the main content.
2. Once several exercises have been added to a day (owner's example: 6), the page has scrolled down by the time you're deep in that list. Clicking an exercise to preview it does correctly select the video, but the page stays scrolled down — the (currently full-width, low-on-the-page-relative-to-scroll) panel isn't visible without manually scrolling back up. Clicking any exercise/video for preview should bring the user back to where the panel is visible.

## Context
- `ExercisePreviewPanel.tsx` (`frontend/src/components/ExercisePreviewPanel.tsx`) — currently sized to fill its container width, with a 16:9 `paddingBottom: "56.25%"` aspect-ratio box (`thumbnailContainerStyle`, line 53-60) that scales with whatever width it's given. It's rendered today as a full-width block inside `PlanBuilder.tsx`'s main content column (`frontend/src/features/workoutPlans/PlanBuilder.tsx:824-827`):
  ```tsx
  {/* Exercise Preview Panel */}
  <div style={{ marginBottom: '20px' }}>
    <ExercisePreviewPanel selected={selectedPreview} />
  </div>
  ```
- Page layout (`PlanBuilder.tsx:699-701` and `1419-1422`): the whole page is `<div style={{ display: 'flex', height: '100vh' }}>` containing two children — the main content column (`className="page-container"`, `flex: 1, overflowY: 'auto'` — **this is the actual scrolling element**, not the window/body) and a fixed-width sidebar column (`width: '320px'`) holding `<ExerciseLibrarySidebar />`.
- The video already supports native fullscreen: the `<iframe>` in `ExercisePreviewPanel.tsx` (line 156-161) has `allowFullScreen` set, which means clicking YouTube's own fullscreen control already triggers the browser's native Fullscreen API and fills the screen — this works regardless of how small the embedding box is. **Do not build a custom fullscreen modal/popup unless you verify live that native fullscreen genuinely doesn't satisfy this** (e.g. some layout clipping bug at small size) — check first, only add a custom popup if the native behavior actually falls short.
- `selectedPreview` state and the `handlePreviewExercise` setter live in `PlanBuilder.tsx` (~line 486-491) and are invoked from three places: the Exercise Library sidebar tab, the Custom Exercises sidebar tab (both via `onPreviewExercise` passed into `ExerciseLibrarySidebar`), and the day's own exercise rows (`PlanBuilder.tsx` ~line 888).

## Requirements

### 1. Shrink the panel
- Reduce `ExercisePreviewPanel`'s footprint significantly — a small, compact box (e.g. roughly sidebar-width scale, ~260-320px) rather than the current full-main-content-width block. Keep the 16:9 aspect ratio for the video area itself, just at a much smaller overall size.
- Reposition it near the top of the page, on the right-hand side — in practice this likely means moving it out of the main content column's normal flow (where it currently sits at `PlanBuilder.tsx:824-827`) and placing it above the `ExerciseLibrarySidebar` in the sidebar column (`PlanBuilder.tsx:1419-1422`), so it reads as a small "now previewing" box sitting at the top of the right-hand side of the page, above the library/custom tabs. Exact placement (e.g. sticky vs. static, precisely how it sits relative to the sidebar's own tabs) is a judgment call — use what fits this app's existing visual style, but the end result must be small and positioned top-right, not full-width in the main content.
- The placeholder state ("Click any exercise to view its preview") and no-video state should shrink proportionally too — don't leave them at the old full-width size while only the video view shrinks.

### 2. Scroll to the panel when any exercise/video is clicked for preview
- The scrolling container is `.page-container` (`PlanBuilder.tsx:701`, `overflowY: 'auto'`) — **not** `window`/`document.body**, since the outer wrapper is a fixed `100vh` flex row. A naive `window.scrollTo(...)` will do nothing here. Get a ref to the actual scrollable element and call `scrollTo({ top: 0, behavior: 'smooth' })` (or set `.scrollTop = 0`) on that ref, not on `window`.
- Trigger this scroll from `handlePreviewExercise` (`PlanBuilder.tsx` ~line 486-491) — since all three preview-click sources (Library tab, Custom tab, day-row list) funnel through this one handler, fixing it there covers all three without touching each call site separately.
- If the preview panel is repositioned into the sidebar column per requirement 1, re-confirm whether this scroll-to-top is still needed for that case specifically (it's clearly needed for the day-row-list source, since that's inside the main scrolling column) — use your judgment, but the day-row click case must end with the panel visible without the user manually scrolling.

## Do NOT
- Do not build a custom video-playing modal/popup unless native iframe fullscreen genuinely fails at the new smaller size — check live first.
- Do not change what gets previewed or how playback starts (still click-to-load, not autoplay-on-select) — this task is layout/positioning and scroll behavior only.
- Do not change the Exercise Library / Custom Exercises sidebar's own tab content, search, or "+ Add" behavior — only where the preview panel sits relative to it.

## Acceptance criteria
- [ ] Preview panel is visibly compact (not full main-content width) and sits near the top-right of the page, live-verified with a screenshot.
- [ ] Clicking a video's own YouTube fullscreen control still fills the screen correctly at the new smaller size.
- [ ] With 6+ exercises added to a day (so the page is scrolled down), clicking any exercise in that day list scrolls the page back to a position where the preview panel is visible, without a full page reload or losing the user's place in the exercise list otherwise.
- [ ] Clicking a Library or Custom Exercises result also still correctly updates the preview panel (no regression from Tasks 58-60's fixes).
- [ ] Full frontend test suite passes; `npx tsc -b` is clean.

## Review checklist
- [ ] Live-verify (browser screenshot) the compact size and top-right position — this is a visual judgment call, not something to approve from code alone.
- [ ] Live-verify the scroll-to-top behavior specifically after scrolling down with several exercises added — reproduce the owner's exact scenario (6 exercises, scroll down, click one) rather than testing scroll in isolation.
- [ ] Confirm the scroll fix targets the actual scrollable element (`.page-container` or equivalent ref), not `window` — a `window.scrollTo` call here would silently do nothing and could pass a careless visual check if the tester doesn't scroll far enough to notice.
