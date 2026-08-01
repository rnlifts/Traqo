# Task 68 — Frontend: replace mobile hamburger sidebar with a bottom tab bar

## Objective
Below the app's existing 768px breakpoint, replace the current hamburger-triggered slide-out sidebar with a fixed bottom navigation bar (Dashboard / Plans / History), and move the user profile/Logout into a small dropdown behind an avatar button in the top bar. Desktop (≥768px) is completely unchanged. This is a **shell-only** change — it touches `Layout.tsx` and `App.css`'s existing 768px media query block, nothing else.

## Context
- `frontend/src/components/Layout.tsx` (127 lines, full file) — the one shared layout wrapping every page in the app (Dashboard, Plans, Active Workout, everything). `navItems` array (lines 12-16) already defines the 3 nav items with icons. `menuOpen` state (line 23) currently drives the mobile sidebar slide-out; `sidebar-footer` (lines 82-96) holds the avatar, display name, username, and Logout button that needs to move into the new top-bar dropdown.
- `frontend/src/App.css` — desktop sidebar styles at lines 4-133 (`.app-shell`, `.sidebar`, `.sidebar-nav`, `.sidebar-link`, `.sidebar-footer`, `.sidebar-user`, `.sidebar-avatar`, `.sidebar-logout`, `.sidebar-brand`, `.mobile-topbar` set to `display: none` by default at line 40-42). The mobile override lives entirely inside the existing `@media (max-width: 768px)` block at **lines 134-186** — this is the only breakpoint block to touch.
- **This exact 768px value is also used elsewhere and depended on independently**: `frontend/src/features/sessions/ActiveWorkout.tsx` has its own `window.matchMedia("(max-width: 768px)")` check (added in Task 66, already live in production) that switches its exercise-preview panel between a desktop side panel and a mobile modal. That logic is completely separate from `Layout.tsx` and must not be touched, but the breakpoint **value** must stay in sync — do not change 768px to any other number anywhere.
- `.app-content` (line 129-132) is the `<main>` wrapper where every page's content renders, including `ActiveWorkout.tsx`, `PlanBuilder.tsx`, and the Custom Exercises tabs — all recently shipped and independently verified in production (Tasks 49-67). Adding bottom padding for the new nav bar happens here, mobile-only.

## Requirements

### 1. Top bar (mobile only, `.mobile-topbar`)
- Keep the logo/brand link as-is.
- Replace the hamburger button (`.hamburger-btn`, currently toggling `menuOpen`) with a small circular avatar button (reuse the existing `.sidebar-avatar` initial-letter style/logic from `Layout.tsx` line 42/84).
- Tapping the avatar opens a small dropdown/sheet showing display name, `@username`, and a Logout button — same content currently in `.sidebar-footer` (lines 83-95), just relocated and restyled to fit a compact dropdown instead of a full-height panel.
- Do not add a notification icon or bell — explicitly excluded by the owner.

### 2. New fixed bottom nav bar (mobile only)
- Renders the same 3 items from `navItems` (`Layout.tsx` lines 12-16) — Dashboard, Plans, History — as icon + label, laid out horizontally, fixed to the bottom of the viewport.
- Active-route highlighting matches the existing `isActivePath` logic and visual treatment already used by `.sidebar-link.active` (accent color/background) — same active-state logic, just a horizontal bottom-bar layout instead of a vertical list.
- `.app-content` needs bottom padding on mobile equal to the bar's height, so page content (including the last item in any list, e.g. Active Workout's "Finish Workout" button) isn't hidden underneath it. Desktop must not get this padding.

### 3. Remove the old mobile sidebar behavior
- The slide-out `.sidebar` (fixed, `transform: translateX(-100%)` / `.open`) and `.sidebar-scrim` backdrop, both mobile-only today (`App.css` lines 159-185), are no longer needed below 768px — the sidebar itself still exists and renders normally at ≥768px (untouched), it just no longer has a mobile "open" state to slide in.
- `menuOpen` state in `Layout.tsx` (line 23) currently drives the old hamburger sidebar. Repurpose or replace it as needed for the new avatar-dropdown open state — your call whether to reuse the same state variable or add a new one, but the old hamburger-triggered sidebar slide-in behavior must not remain reachable on mobile.

## Do NOT
- **Do not touch any file outside `Layout.tsx` and `App.css`'s existing 768px media query block.** In particular, do not modify `ActiveWorkout.tsx`, `PlanBuilder.tsx`, `ExercisePreviewPanel.tsx`, `ExerciseWorkoutPreview.tsx`, `Modal.tsx`, `CustomExerciseForm.tsx`, `ExerciseLibrarySidebar.tsx`, or any backend file — all of this is freshly shipped and independently verified in production as of today (Tasks 49-67); this task must not regress any of it.
- Do not change the `768px` breakpoint value anywhere, including introducing a *different* breakpoint for the new bottom bar than what the rest of the app already uses.
- Do not change any desktop (≥768px) styling or behavior — the existing sidebar must render pixel-identical to today above 768px. If you need to verify this, compare computed styles before/after your change at a desktop viewport.
- Do not add a notification/bell icon anywhere in this change.
- Do not remove or restyle `.sidebar`, `.sidebar-nav`, `.sidebar-link`, etc.'s desktop CSS rules (lines 4-133) — only the mobile override block (134-186) and `Layout.tsx`'s JSX/state change.
- Do not touch `ConfirmDialog` usage or the unsaved-changes nav-guard logic (`handleNavClick`, `pendingNavTarget`, lines 31-37 and 109-123) beyond whatever minimal wiring is needed to keep it working from the new bottom-bar nav links — this existing guard (blocking navigation away from an in-progress plan) must keep working exactly as it does today, just triggered from the new bottom nav instead of the old sidebar links.

## Acceptance criteria
- [ ] At ≥768px, the app is visually and behaviorally identical to before this change — full sidebar, no bottom bar, no avatar dropdown.
- [ ] At <768px: no hamburger button, no slide-out sidebar; a fixed bottom bar with Dashboard/Plans/History (icon + label, correct active-state highlighting) is visible on every page.
- [ ] Tapping the top-bar avatar opens a dropdown with display name, username, and a working Logout button; tapping elsewhere closes it.
- [ ] Page content is never hidden behind the fixed bottom bar on any page, including ones with content or buttons near the bottom of the viewport (e.g. Active Workout's "Finish Workout" button, Plan Builder's "Save Plan" button).
- [ ] The unsaved-changes navigation guard (leaving an in-progress plan) still triggers correctly when tapping a bottom-nav item while there are unsaved changes.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify at both a desktop width (≥768px) and a real mobile width (~375-414px) — screenshot both, don't just read the code.
- [ ] Specifically re-check `ActiveWorkout.tsx`'s own mobile modal (Task 66) still works correctly at a mobile width after this change — it renders inside `.app-content`, which this task modifies the padding of; confirm the preview modal and the new bottom bar don't overlap or conflict.
- [ ] Confirm no regression on at least one other page (e.g. Plan Builder) at mobile width, not just Dashboard — this is a shell change affecting every page, not just the one the owner is currently looking at.
- [ ] Confirm the 768px breakpoint value was not changed or duplicated with a slightly different number anywhere.
