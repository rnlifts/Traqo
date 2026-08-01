# Task 71 — Frontend (mobile only): collapse the video preview panel to a per-row trigger

## Objective
On mobile (<768px) only, remove the persistent full-width `ExercisePreviewPanel` currently sitting at the very top of the Plan Builder page (showing an empty placeholder until something is clicked) and replace it with a small preview trigger on each exercise row — tapping it opens the video in a `Modal`, instead of dedicating permanent screen space to a mostly-empty panel. Desktop (≥768px) is unchanged — the compact top-right panel stays exactly as it is. Depends on Task 70 being done first (this task adds preview triggers to rows both in the day's own list and inside Task 70's new picker modal).

## Folder structure — no new folder needed
Reuses what already exists:
- **`Modal.tsx`** (Task 64) — same component Task 70 uses for the exercise picker.
- **`ExercisePreviewPanel.tsx`** (`frontend/src/components/`) — already renders name + video + placeholder/no-video states, already has a `fullWidth` prop (Task 69). No new preview-rendering component needed; put the existing one inside `Modal` for mobile instead of building something new.

## Context — exact current state in `frontend/src/features/workoutPlans/PlanBuilder.tsx`
- Lines 721-724: the mobile-only persistent top panel — `{isMobile && (<div style={{padding:'20px', overflowY:'auto', borderBottom:'1px solid var(--border)'}}><ExercisePreviewPanel selected={selectedPreview} fullWidth={true} /></div>)}`. **This whole block is what gets removed on mobile** (desktop's equivalent at lines 809-812 is untouched).
- Line 106: `selectedPreview` state — keep using this as the single source of truth for "what's currently being previewed." Do not introduce a second, parallel preview state.
- Line 507: `handlePreviewExercise(exerciseInfo)` — the existing handler that sets `selectedPreview`. Keep calling this from wherever a preview is triggered (day-row, and library rows inside Task 70's modal) — do not duplicate its logic.
- Line 922: the day's own exercise row (`className="exercise-row"`), whose click handler already calls `handlePreviewExercise` (from Task 60/62) plus a scroll-to-top call. On mobile, since the persistent top panel is gone, **the scroll-to-top call no longer has anything to scroll to** — instead, clicking a day-row's preview trigger should open the `Modal` with `ExercisePreviewPanel` inside it, not attempt to scroll anywhere. Read the exact current onClick body here before changing it (it currently does both `handlePreviewExercise(...)` and `pageContainerRef.current?.scrollTo(...)`) — on mobile this whole interaction changes shape (opens a modal) rather than just needing a tweak.
- `ExerciseLibrarySidebar.tsx`'s `onPreviewExercise` prop (passed as `handlePreviewExercise` at whatever the picker-modal wiring ends up being after Task 70) — clicking a library/custom-exercise row already calls this. On mobile, this should now also open the same `Modal`-based preview instead of updating a panel that no longer exists in that position.

## Complete user use case (mobile)
1. **Day's own exercise list**: each row (already showing a small thumbnail from Task 65's pattern reused here — check whether `PlanBuilder.tsx`'s day-row already has a thumbnail like `ActiveWorkout.tsx`'s does; if not, add one using the same `getYoutubeThumbnailUrl` pattern already used elsewhere in this codebase) has a clear tap target (the thumbnail, or the row itself) that opens `Modal` containing `ExercisePreviewPanel` for that specific exercise. No auto-play — same click-to-play-inside-the-panel behavior that already exists, unchanged.
2. **Inside Task 70's picker modal**: tapping a library or custom-exercise row (not the "+Add" button — same distinction that already exists today via `stopPropagation`, Task 60) opens the *same* preview `Modal` on top, showing that exercise's video before the user decides whether to add it.
3. Closing the preview modal returns to wherever the user was (day view, or still inside the picker modal if that's where they opened it from) — the preview modal must not accidentally close the picker modal underneath it if opened from there (i.e., these can end up nested/stacked — confirm this works, or if `Modal` doesn't support stacking cleanly, decide and document an alternative like closing the picker first before showing preview, whichever gives the less confusing experience).
4. Placeholder state (nothing selected) simply doesn't need a home anymore on mobile — there's no persistent panel sitting empty, so there's nothing to show a placeholder in. This is a **feature of this change**, not a gap: the empty state (docs/sprints.md UX research) was flagged as one of the actual problems.

## Do NOT
- Do not touch desktop (≥768px) — the compact top-right panel and its own click/scroll behavior (Tasks 62, 65) stay exactly as-is.
- Do not modify `ExercisePreviewPanel.tsx`'s own internals (its no-autoplay, click-to-play-in-panel logic is correct and independently verified) — only where/how it's mounted on mobile.
- Do not remove `selectedPreview` state or `handlePreviewExercise` — reuse them, don't replace with something new.
- Do not touch `ActiveWorkout.tsx` or its own separate preview-modal implementation (Task 66) — this is a different page with its own, already-correct mobile preview handling.
- If Task 70 hasn't landed yet, do not start this task — it explicitly depends on the picker-modal wiring existing first.

## Acceptance criteria
- [ ] Mobile: no persistent top-of-page video panel; each day-row and each library/custom-exercise row (inside the Task 70 modal) has a clear tap-to-preview trigger.
- [ ] Tapping it opens a modal with the correct exercise's video (or "no video available" state) — no autoplay.
- [ ] Preview modal opened from inside the picker modal doesn't break or unexpectedly close the picker underneath it.
- [ ] Desktop completely unchanged.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify on a real mobile width: click-to-preview from both the day's own list and from inside the picker modal.
- [ ] Confirm the old day-row scroll-to-top call (Task 62/69) was correctly replaced with the new modal-open behavior on mobile, not left dangling calling `.scrollTo()` on something that no longer needs it.
- [ ] Confirm desktop's preview panel and its own scroll-to-top behavior are provably unaffected (fresh-tab check).
