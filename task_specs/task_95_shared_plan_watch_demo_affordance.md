# Task 95 — Frontend: visible "Watch Demo" button on the shared (view-only) plan page

## Objective
On the read-only shared-plan page (`https://traqofit.com/shared/{token}`), each
exercise row is clickable to open a video preview — but nothing about the row
*looks* clickable to a first-time viewer (a link someone shares with a friend/
client who has never used the app). Add a small, visually distinct "Watch Demo"
button to each row so it's immediately obvious the exercise has a demo video.

## Context
- File: `frontend/src/pages/SharedPlanPage.tsx`, the `ExerciseRow` component
  (currently lines ~23-141).
- Today: the **entire row div** (thumbnail + name + summary text) is one click
  target (`onClick={handleClick}` on the outer div, line 54), with only
  `cursor: 'pointer'` as a hint — invisible on touch devices, easy to miss even
  on desktop. Clicking anywhere on the row calls `onPreview(...)`, which opens
  a modal via `ExercisePreviewPanel` (parent page owns that modal/state, not
  part of this task).
- **Explicitly a different surface from the logging view.** `ActiveWorkout.tsx`
  already has its own "Watch demo ▶" affordance (`t.activeWorkout.watchDemo`,
  around line 1031) styled as an inline text link under the exercise name,
  positioned where it is specifically because each exercise row there can
  expand into a set-logging panel — a button added below it would visually
  collide with that expansion. **Do not touch `ActiveWorkout.tsx` or
  `t.activeWorkout.watchDemo` in this task.** This task is scoped only to
  `SharedPlanPage.tsx`'s `ExerciseRow`.
- i18n: this page's copy lives under the `sharedPlanPage` namespace in
  `frontend/src/i18n/en.ts` / `ne.ts` (not `activeWorkout`) — add the new
  button's label there, do not reuse `t.activeWorkout.watchDemo`.

## Requirements

### 1. Add a distinct "Watch Demo" button to `ExerciseRow`
- Place it so it reads as its own actionable element, not just a repeat of the
  existing click-anywhere behavior — e.g. a small pill/button anchored to the
  right side of the row or directly under the summary text, using
  `var(--accent)` (or similar) as a filled/bordered background so it visually
  pops against the row, unlike the current plain-text feel of the row.
- The button's own `onClick` should call the same `handleClick`/`onPreview`
  the row already uses — same preview behavior, just an obvious second way to
  trigger it. Keep the whole-row click-to-preview behavior too (don't remove
  it — some users will still just tap the row); the button is an *additional*,
  more discoverable entry point, not a replacement.
- `stopPropagation` isn't actually needed here since both the row's own
  `onClick` and the button's `onClick` do the same thing — but double check
  in testing that clicking the button doesn't cause the preview modal to open
  twice or flicker (event bubbling to the row's own handler calling `onPreview`
  a second time is harmless functionally, just confirm it doesn't cause any
  visible double-render/flash).
- Give it a real `aria-label` / accessible name distinct from the row's own
  (e.g. "Watch demo for {exercise name}"), and keep it keyboard-reachable
  (a real `<button>`, not another `role="button"` div).

### 2. New i18n key
- Add a new key under `sharedPlanPage` in both `en.ts` and `ne.ts` (e.g.
  `watchDemo: 'Watch Demo'` / the Nepali equivalent) — do not reuse or rename
  `t.activeWorkout.watchDemo`. `ne.ts`'s `satisfies TranslationKeys` will
  catch it if the key is missing there.

### 3. When there's no video
- `exercise.video_url` can be null (confirmed elsewhere in this file: the
  thumbnail already has a 🏋️ fallback for this case). Decide and implement a
  sensible treatment for the new button when there's no video — most likely:
  don't render the button at all for that row (there's nothing to watch), same
  logic gate the thumbnail fallback already uses. State whatever you chose in
  the PR/commit description so the PM can confirm it was a deliberate choice,
  not an oversight.

## Do NOT
- Do not modify `ActiveWorkout.tsx`'s existing "Watch demo" link/behavior —
  different surface, different layout constraints, explicitly out of scope.
- Do not modify `ExercisePreviewPanel`, `ExerciseWorkoutPreview`, or the modal
  logic that owns `PreviewInfo` state in `SharedPlanPage.tsx` — this task is
  only about adding a more visible *trigger* for the existing preview, not
  changing what the preview shows or how it's opened at the state-management
  level.
- Do not change the plan-owner's own Plan Builder exercise rows (a visually
  similar but separate component/context) — this is specifically about the
  read-only shared-link view a non-owner sees.

## Required tests
- A test asserting the new button renders when `exercise.video_url` is present,
  and does not render (or is disabled — pick one per Requirement 3 and test
  that) when it's null.
- A test asserting clicking the new button calls the same `onPreview` callback
  with the same `PreviewInfo` shape the row's own click already produces.
- Existing `SharedPlanPage` tests (if any cover `ExerciseRow`) must still pass
  unmodified in intent — update only what's needed to accommodate the new
  button's presence in the DOM (e.g. if a test does `getByText(exercise name)`
  inside a `closest('button')` assumption that no longer holds).

## Acceptance criteria
- [ ] Every exercise row with a video on the shared-plan page shows an obvious,
      visually distinct "Watch Demo" button — not just a plain-text link, not
      just cursor:pointer on the row.
- [ ] Clicking the button opens the same preview the row itself already opens.
- [ ] Rows without a video handle the button's absence/disabled-state sensibly
      (no dead button that does nothing when clicked).
- [ ] `ActiveWorkout.tsx` is untouched — verify with `git diff` before calling
      this done.
- [ ] Checked at both a normal and a short/narrow viewport (per project
      policy) — confirm the new button doesn't crowd or overlap the existing
      thumbnail/name/summary/notes content in the row, especially for exercises
      with long names or notes.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify by opening an actual shared-plan link in a browser (not just
      reading the diff) — confirm the button is genuinely eye-catching at a
      glance, not just technically present.
- [ ] Confirm `git diff -- frontend/src/features/sessions/ActiveWorkout.tsx`
      is empty.
- [ ] Confirm the no-video-row treatment matches what Requirement 3 says was
      decided, and that it was a deliberate choice per the commit message.
