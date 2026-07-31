# Task 58 — Frontend: shared YouTube utils + a reusable ExercisePreviewPanel component

## Objective
Build a generic, reusable video preview component and shared YouTube URL utilities — not hardcoded to the Plan Builder — so a future active-workout video feature can reuse this exact component with zero rework, just different data passed in. This task builds the component in isolation; Task 59 wires it into the Plan Builder.

## Context
- `getYoutubeThumbnail(videoUrl)` already exists but is stuck as a private function inside `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx` (added recently, extracts a YouTube thumbnail image URL from a `video_url`, mirroring the backend's `derive_youtube_thumbnail()` logic — same two accepted shapes: `youtube.com/watch` and `youtu.be/`).
- There's no existing helper that produces a YouTube **embed** URL (the `https://www.youtube.com/embed/{id}` form needed for an actual playable `<iframe>`) — this task adds one, using the exact same video-ID-extraction logic as `getYoutubeThumbnail`, just a different output URL shape.
- Owner's explicit UX decisions for the preview panel (already confirmed, don't re-litigate):
  - Compact size, not the large hero-video style from the reference design.
  - Always visible, even with nothing selected — shows a placeholder state ("click any exercise to view preview") rather than collapsing/disappearing.
  - Clicking an exercise loads it into the panel but does **not** autoplay — the user clicks a play control to actually start the video, avoiding random autoplay noise while browsing.

## Requirements

### 1. Shared YouTube utility module
New file, e.g. `frontend/src/utils/youtube.ts`:
- `extractYoutubeVideoId(videoUrl?: string | null): string | null` — the core ID-extraction logic (currently duplicated conceptually between the backend's `derive_youtube_thumbnail` and frontend's `getYoutubeThumbnail`), single source of truth on the frontend side.
- `getYoutubeThumbnailUrl(videoUrl?: string | null): string | null` — thumbnail image URL, built from `extractYoutubeVideoId`.
- `getYoutubeEmbedUrl(videoUrl?: string | null): string | null` — `https://www.youtube.com/embed/{id}` form, for iframe embedding.
- Update `ExerciseLibrarySidebar.tsx` to import `getYoutubeThumbnailUrl` from this new shared module instead of its own local `getYoutubeThumbnail` — remove the duplicate, don't leave both existing.

### 2. `ExercisePreviewPanel` component
New file, e.g. `frontend/src/components/ExercisePreviewPanel.tsx`:
- Props: `selected: { name: string; video_url: string | null } | null` — `null` means nothing selected. Keep this prop shape minimal and generic (just what's needed to preview one exercise) so it's trivially reusable later — do not add any Plan-Builder-specific props (no `dayId`, no `exerciseRowId`, etc.).
- **Nothing selected** (`selected === null`): show a placeholder — simple, compact, e.g. an icon + "Click any exercise to view its preview" text. Must not be visually heavy — this is the resting state most of the time.
- **Something selected, has a `video_url`**: show a thumbnail image (via `getYoutubeThumbnailUrl`) with a play button overlay. Clicking the play button swaps in a real `<iframe>` using `getYoutubeEmbedUrl` (with `autoplay=1` only once the user has clicked play — the initial render must NOT autoplay). Show the exercise's name.
- **Something selected, no `video_url`**: show a simple "no preview available" state with the exercise name — not an error, just an honest empty state.
- Keep the overall footprint compact (this is a deliberate reaction to the reference design being too large) — a reasonable target is roughly 1/3 to 1/2 the height of the reference screenshot's video area, but use your judgment for what reads as "compact" against this app's existing layout density.

## Do NOT
- Do not wire this component into `PlanBuilder.tsx` yet — that's Task 59.
- Do not add any Plan-Builder-specific logic, imports, or props to `ExercisePreviewPanel` — it must be a plain, reusable, presentational component that only knows about `{name, video_url}`.
- Do not touch backend code — Task 56 already did the necessary backend work.
- Do not remove the existing thumbnail rendering already used in the sidebar's search results / Custom Exercises list — only refactor it to use the new shared util, same visual behavior.

## Acceptance criteria
- [ ] `frontend/src/utils/youtube.ts` exists with all three functions, each independently unit-testable.
- [ ] `ExercisePreviewPanel` renders all three states correctly (nothing selected / has video / no video) when manually driven with different prop values.
- [ ] Clicking play actually starts video playback (real iframe embed, not just a static image) — verify live in a browser with a real YouTube URL.
- [ ] The panel does not autoplay on initial selection — confirmed by checking the iframe isn't rendered (or doesn't have autoplay) until after a play click.
- [ ] `ExerciseLibrarySidebar.tsx`'s existing thumbnail behavior (search results, Custom Exercises list) is unchanged after switching to the shared util — no visual regression.
- [ ] Full frontend test suite passes, plus new unit tests for the youtube.ts utilities and the ExercisePreviewPanel component's three states.

## Review checklist
- [ ] Confirm `ExercisePreviewPanel` has zero imports from `PlanBuilder.tsx` or any plan-specific API/type — genuinely reusable.
- [ ] Confirm the old duplicate `getYoutubeThumbnail` in `ExerciseLibrarySidebar.tsx` was actually removed, not left dangling alongside the new shared one.
