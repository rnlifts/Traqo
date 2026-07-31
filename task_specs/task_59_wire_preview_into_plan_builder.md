# Task 59 — Frontend: wire the preview panel and thumbnails into the Plan Builder

## Objective
Put Task 58's `ExercisePreviewPanel` to work inside `PlanBuilder.tsx`: click any exercise anywhere on the page (Exercise Library sidebar, Custom Exercises sidebar, or the day's own exercise list) to load it into a compact, always-visible preview panel; add a plain thumbnail to each exercise row in the day view. Depends on Tasks 56-58.

## Context
- `PlanBuilder.tsx`'s exercise rows for the current day live around line 842-1083 (`currentDay.exercises.map((ex, idx) => ...)`), each rendered as a `.exercise-row` div. The name cell is `.field-cell.field-cell-name` (~line 866-868), currently just showing `{idx + 1}. {ex.exercise_name}` as static text — no thumbnail at all today.
- `ExerciseLibrarySidebar.tsx` renders in the same page (~line 1334), receiving `onSelectExercise` and `onExerciseCreated` props. Its search results (Exercise Library tab) and Custom Exercises tab both already have "+ Add" buttons per row (`handleSelectExercise`) — this task needs those *rows themselves* (not just the Add button) to also be clickable for preview purposes, without accidentally triggering an add.
- Owner's confirmed UX: the panel is compact and always visible, defaulting to a placeholder ("click any exercise to view preview") until something is clicked; clicking loads (not autoplays) the video.
- Owner's confirmed row styling: **just a plain thumbnail, nothing else** — no duration badge, no muscle-group/type pill tags, no description text, no "View details" link. Everything else about the row stays exactly as it is today.

## Requirements

### 1. Preview selection state in PlanBuilder
- Add state to `PlanBuilder.tsx` for "currently previewed exercise" — `{ name: string, video_url: string | null } | null`.
- Render `ExercisePreviewPanel` (Task 58) somewhere sensible in the layout — given it's compact and always visible, a natural spot is near the top of the main content area, above or alongside the day tabs (use your judgment for exact placement within this app's existing layout, but it shouldn't push the day's exercise list far down or dominate the screen).

### 2. Wire click-to-preview from all three sources
- **Exercise Library sidebar results**: clicking anywhere on a result row (not just the "+ Add" button) sets it as the preview selection. Keep "+ Add" as its own distinct click target that still adds to the plan — clicking the row body previews, clicking "+ Add" adds (and may also preview, your call, but adding must not require a separate preview click first).
- **Custom Exercises tab**: same pattern — clicking a custom exercise's row previews it.
- **The day's own exercise list** (in the main content area): clicking an exercise row (or its new thumbnail specifically — pick whichever doesn't conflict with the row's existing inputs/buttons like Sets/Reps/Delete) sets it as the preview selection using that row's own `exercise_name`/`video_url` (available now via Task 56's backend change).
- This requires passing `video_url` through from wherever `LibraryExercise`/`Exercise`/day-exercise data already flows — check Task 57's widened `onSelectExercise` payload for the sidebar sources, and the day exercise's own already-available `video_url` field (from Task 56) for the third source.

### 3. Plain thumbnail on each day-exercise row
- Add a small thumbnail image next to each exercise's name in the `.field-cell-name` cell (or immediately adjacent, matching this app's existing visual density — check how the sidebar renders its own thumbnails for a consistent size/style, e.g. ~40-48px).
- Use `getYoutubeThumbnailUrl` (Task 58) on the exercise's `video_url`. No `video_url` → same fallback treatment already established elsewhere (icon placeholder), not a broken image.
- Do not add anything else to the row — no badges, tags, description, or links, per the owner's explicit instruction.

## Do NOT
- Do not add duration badges, muscle-group/type pill tags, description text, or "View details" links anywhere — explicitly rejected by the owner.
- Do not make the preview panel autoplay on selection (Task 58 already handles this correctly; just don't break it while wiring).
- Do not change how "+ Add" itself works (adding to the day) — only add preview-on-click alongside it.
- Do not touch `ActiveWorkout.tsx` — this task is Plan Builder only; the active-workout video feature is a distinct, later, not-yet-scoped piece of work (see memory `traqo-exercise-preview-video-plan`), and Tasks 56-58 were deliberately built to make that painless later, not to include it now.

## Acceptance criteria
- [ ] Preview panel is visible on the Plan Builder page at all times, showing the placeholder state by default.
- [ ] Clicking a result in the Exercise Library tab, a result in the Custom Exercises tab, and an exercise already in the current day's list all correctly load that exercise into the preview panel (verified live for all three, not just one).
- [ ] "+ Add" still adds to the plan correctly, no regression (re-verify the earlier 409-fix scenario still works, since this task touches the same click handlers).
- [ ] Each day-exercise row shows a plain thumbnail (or fallback icon) and nothing else new.
- [ ] Video doesn't autoplay on selection; playing requires an explicit click on the panel's play control.
- [ ] Full frontend test suite passes, plus new tests covering the click-to-preview wiring from at least two of the three sources.

## Review checklist
- [ ] Confirm clicking a row for preview doesn't interfere with clicking "+ Add", "Edit", "Delete", or any of the day-row's own inputs (Sets/Reps/Weight/Notes/Vary-by-set/Remove) — these all need to keep working exactly as before.
- [ ] Get a live visual check (screenshot or direct browser check) of the compact panel size against the actual page layout — "compact" is a judgment call worth actually looking at, not just assuming from code.
