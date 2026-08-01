# Task 70 — Frontend (mobile only): "+ Add Exercise" as a full-screen picker instead of an always-visible inline section

## Objective
On mobile (<768px) only, replace the always-visible Exercise Library/Custom Exercises section currently sitting inline at the bottom of the Plan Builder page with a full-screen modal takeover, opened by a single sticky "+ Add Exercise" button. Desktop (≥768px) is completely unchanged — the sidebar library stays exactly as it is today. This directly targets the owner's top research-backed recommendation: users currently scroll past an empty exercise list just to reach the library, instead of the library being summoned on demand (how Hevy/Strong do it).

## Folder structure — no new folder needed
Everything needed already exists in `frontend/src/features/workoutPlans/` and `frontend/src/components/`. This task reuses two components already built and verified in earlier tasks:
- **`Modal.tsx`** (`frontend/src/components/Modal.tsx`, built in Task 64, already used by `ActiveWorkout.tsx`'s mobile preview) — a generic, content-agnostic overlay. Use it as-is; do not modify it.
- **`ExerciseLibrarySidebar.tsx`** (`frontend/src/features/exerciseLibrary/`) — already has search, muscle-group filters, Library/Custom tabs, thumbnails, and "+Add" buttons fully working. It does not need to be rewritten for this task; it just needs to render *inside* `Modal` instead of inline in the page.

Do not create a new component file for "the picker" — this is a wiring/layout change (where `ExerciseLibrarySidebar` renders, and what triggers it), not a new feature needing new business logic.

## Context — exact current state in `frontend/src/features/workoutPlans/PlanBuilder.tsx`
- Line 114: `isMobile` state (from Task 69), already correctly detects the breakpoint via `matchMedia`. Reuse it — do not add a second mobile-detection mechanism.
- Lines 1417-1420: the mobile-only block that renders `<ExerciseLibrarySidebar>` inline, always visible, at the bottom of the page (below "Save Plan"). **This is what gets wrapped in `Modal` and hidden until requested** — do not delete `ExerciseLibrarySidebar`'s usage, just relocate how/when it's shown on mobile.
- Lines 1469-1472: the **desktop** `<ExerciseLibrarySidebar>` block (sidebar column, `!isMobile`). **Do not touch this.**
- Line 1371: the empty-state copy ("Add exercises using the panel below ↓" on mobile, just fixed). This line's text and the new "+ Add Exercise" button from this task should effectively replace each other — once there's a real button here, the instructional copy can point at it directly or be removed in favor of the button itself being self-explanatory. Your call on exact wording, but don't leave both a vague instruction *and* a separate unlabeled trigger elsewhere — the point of this task is a direct, obvious path from "empty list" to "add something."
- `handleQuickAddExercise`, `onExerciseCreated` → `handleExerciseCreated`, `onPreviewExercise` → `handlePreviewExercise` (all passed into `ExerciseLibrarySidebar` today at line 1419) — these callbacks are real, working, independently-verified logic (Tasks 57, 60, 65). Pass them through unchanged into the modal-wrapped version; do not reimplement any of them.

## Complete user use case (mobile)
1. User is on the Plan Builder page, Day 1 selected, exercise list empty (or partially filled).
2. Instead of scrolling past a library section, they see their exercise list, then a clearly-visible **"+ Add Exercise"** button (sticky at the bottom of the exercise list, or directly in the empty state — your call on exact placement, but it must be reachable without scrolling past unrelated content).
3. Tapping it opens the exercise picker as a **full-screen modal** (use `Modal`, but note: `Modal`'s current styling — `maxWidth: '90vw', maxHeight: '90vh'`, centered — is designed for a small centered dialog, not necessarily a true full-screen mobile takeover. Check live whether that sizing reads as "full-screen enough" for this use case on a real phone width; if not, this is the one place you may need a mobile-specific size override passed via a prop or wrapping style, without changing `Modal`'s own default behavior for its other current callers (`ActiveWorkout.tsx`'s Task 66 usage) — do not change `Modal.tsx`'s defaults globally to fix this).
4. Inside the modal: the same search bar, muscle-group filters, Library/Custom tabs, thumbnails, and "+Add" buttons that exist today — unchanged in behavior.
5. Tapping "+Add" on an exercise adds it to the current day (same `handleQuickAddExercise` flow as today, same double-tap-guard from the previous fix, same toast) — **and the modal stays open**, so the user can add several exercises in one sitting without re-opening it each time (matches how repeat use actually happens — don't force a close-and-reopen per exercise).
6. User taps the modal's close button (or backdrop) when done, returns to the day view, now showing their added exercises.
7. This exact flow must also work from a fresh/empty day and from a day that already has exercises — both are real starting states.

## Do NOT
- Do not touch desktop (≥768px) rendering at all — verify with computed styles, not just a glance.
- Do not modify `ExerciseLibrarySidebar.tsx`'s internal search/filter/tab/add logic — only how/where it's mounted on mobile.
- Do not modify `Modal.tsx`'s default sizing behavior in a way that affects `ActiveWorkout.tsx`'s existing usage of it (Task 66) — if you need different sizing here, make it opt-in (e.g. a new prop), not a change to the default.
- Do not touch `ActiveWorkout.tsx`, backend files, or anything unrelated to this one interaction change.
- Do not build this as a new route/page — it's a modal within the existing Plan Builder page, matching how Hevy/Strong keep you in-context rather than navigating away.

## Next step (not part of this task — context only)
Task 71 (video preview → per-row, replacing the persistent top panel) touches rows *inside* this same modal (both the day's own exercise rows and the library rows shown here) — do this task (70) first so Task 71 has a stable place to add its per-row preview trigger.

## Acceptance criteria
- [ ] Mobile: no library section visible until "+ Add Exercise" is tapped; tapping it opens a full-screen-feeling modal with the existing library/search/tabs/add functionality intact.
- [ ] Adding an exercise keeps the modal open; the day's exercise list updates in the background/on close.
- [ ] Closing the modal (button + backdrop) returns to the day view with correctly updated exercises.
- [ ] Desktop unchanged — sidebar library still always visible, same as before this task.
- [ ] Works from both an empty day and a day with existing exercises.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify at a real mobile width with a screenshot — confirm it actually reads as "full-screen," not a small awkward centered box.
- [ ] Re-confirm the double-tap-guard fix (most recent commit) still works for "+Add" clicks made from inside this modal.
- [ ] Confirm desktop is untouched with a fresh-tab side-by-side check.
- [ ] Confirm `Modal.tsx` itself was not edited in a way that changes `ActiveWorkout.tsx`'s mobile preview modal's appearance — check that one still looks the same too.
