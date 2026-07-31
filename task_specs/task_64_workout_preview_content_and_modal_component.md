# Task 64 — Frontend: reusable exercise-preview content + a generic Modal component

## Objective
Build two small, reusable pieces needed for the Active Workout preview feature, with no wiring into `ActiveWorkout.tsx` yet (that's Task 65/66): (1) the actual preview content — video + exercise name + muscle-group/equipment tag pills — and (2) a generic modal/overlay component, since none exists in this codebase today. Depends on Task 63 (backend fields) being available.

## Context
- `frontend/src/components/ExercisePreviewPanel.tsx` (122 lines, confirmed current state) already does video + name, but with **no tag pills** and a **fixed `360px` width** (line 20) — built for Plan Builder, not this screen. Do not modify this file; Active Workout needs its own variant since it displays additional info (tags) Plan Builder doesn't need, and needs to render inside both a side panel and a modal (two different containers) rather than a single fixed-width block. Its existing pattern is worth following closely though: a plain `<iframe src={embedUrl} allowFullScreen />` once `video_url` resolves via `getYoutubeEmbedUrl` (`utils/youtube.ts`), no custom play-button/thumbnail-click gating (that pattern was deliberately removed from `ExercisePreviewPanel` — don't reintroduce it here).
- `frontend/src/utils/youtube.ts` exports `extractYoutubeVideoId`, `getYoutubeThumbnailUrl`, `getYoutubeEmbedUrl` — reuse these directly, no changes needed.
- No generic modal component exists anywhere in `frontend/src` (confirmed via search) — the only two dialog-like components are `ConfirmDialog.tsx` (hardcoded title/message/confirm/cancel shape, no `children` prop, can't host a video) and `RegistrationSuccessDialog.tsx` (also purpose-specific). You need to build a new one.
- `ConfirmDialog.tsx`'s overlay styling (fixed positioning, centered, `zIndex: 1000`) is a reasonable pattern to reference for the new modal's backdrop/positioning, but the component itself isn't reusable as-is — build a proper `children`-accepting modal, don't copy-paste-and-hack `ConfirmDialog`.
- After Task 63, `muscle_group` and `equipment` will be available on `WorkoutExerciseDetailedResponse` — this task's preview content component should accept them as props (both `string | null`).

## Requirements

### 1. `ExerciseWorkoutPreview` component (or similar name — your call, but keep it distinct from `ExercisePreviewPanel` since it's a different component with different props/output, not a variant of the same one)
- Props: `{ name: string; video_url: string | null; muscle_group: string | null; equipment: string | null }` (a plain object, no `| null` wrapper on the whole prop — this component always has something to show once rendered; the *caller* decides whether to render it at all).
- Renders: exercise name, the video (plain iframe via `getYoutubeEmbedUrl`, same no-autoplay/no-custom-play-button approach as `ExercisePreviewPanel`, fallback "No video available" state if `video_url` is null/invalid), and small tag pills for `muscle_group` and `equipment` (only rendering a pill for whichever of the two is non-null — don't render an empty pill).
- Do not hardcode a fixed width — this needs to work inside both a side-panel column (Task 65) and a modal (Task 66), so size to its container (`width: 100%` or similar) rather than a fixed pixel value.

### 2. Generic `Modal` component
- Props: something like `{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string }`.
- Standard behavior: renders nothing when `isOpen` is false; backdrop click and an explicit close control (× button) both call `onClose`; traps nothing fancy needed (no focus-trap library required) but should not scroll the background page while open (a simple `overflow: hidden` on `document.body` while mounted is enough, restored on unmount/close).
- This is a generic container — it must not know anything about video/exercises. `ExerciseWorkoutPreview` (above) gets passed as `children` by whatever wires it in later (Task 66), not built into `Modal` itself.

## Do NOT
- Do not modify `ExercisePreviewPanel.tsx` or wire either new component into `ActiveWorkout.tsx` — that's Tasks 65 and 66.
- Do not add exercise-specific logic to `Modal` — keep it a plain, reusable container.
- Do not reintroduce a custom thumbnail/play-button click gate before showing the iframe — this was deliberately simplified away in `ExercisePreviewPanel` and the same reasoning applies here (YouTube's own embed already shows its own play button and doesn't autoplay without the `autoplay` param).

## Acceptance criteria
- [ ] `ExerciseWorkoutPreview` renders correctly with: both tags present, only one tag present, no tags, valid video, no video — all as distinct test cases.
- [ ] `Modal` renders nothing when closed, renders `children` when open, closes on backdrop click and on an explicit close button, and doesn't leak a scroll-locked body if mounted/unmounted repeatedly.
- [ ] New unit tests for both components, following this project's existing testing conventions (unconditional assertions, no `if (element) { expect(...) }` patterns — this codebase has repeatedly caught and fixed that exact anti-pattern in past tasks).
- [ ] `npx tsc -b` clean, full frontend test suite passes.

## Review checklist
- [ ] Confirm neither component is wired into any real page yet — this task is components only, in isolation (verify via grep that neither is imported from `ActiveWorkout.tsx`).
- [ ] Confirm the video branch genuinely doesn't autoplay and has no custom play-button click gate, matching `ExercisePreviewPanel`'s current (already-simplified) behavior.
