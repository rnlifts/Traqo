# Task 32 — Shared "Plan Everything Upfront" / "Start Small" action cards

## Objective
Replace the current tiny, easy-to-miss "Or log today's workout without a plan →" text link with a full-sized, equally-prominent card alongside "Create Plan" — matching the reference mockup provided by the product owner. Add this two-card block to **both** the Dashboard and the Plans page (Dashboard currently has no quick-start entry point at all).

## Context
- Reference mockup (from the originating conversation): two side-by-side dashed-border cards under the heading "What would you like to do today?" — left card blue-bordered "Plan Everything Upfront" / "Create your complete workout routine before you start training." / blue "Create Plan →" button; right card green-bordered "Start Small. Build Over Time ⭐" / "Log today's workout and build your routine one session at a time." / green "Start Today →" button.
- Both existing entry points already work today, just via mismatched-prominence UI:
  - **Create Plan**: `frontend/src/features/workoutPlans/PlanList.tsx:116-122` (the `.create-tile` button) and `frontend/src/pages/Dashboard.tsx:70-76` (identical tile) both just `navigate("/workout-plans/new")`.
  - **Quick start**: only exists today on `PlanList.tsx:48-64,125-127` (`handleQuickStart`) — calls `workoutSessionsApi.quickStart()`, handles the `409` (unresolved-session-exists) case from Task 28/29 by toasting and redirecting to `/dashboard`, otherwise navigates to `/workout-sessions/{session_id}`. Dashboard has no equivalent today.
- Icons already exist and match the mockup — no new icons needed: `ClipboardIcon`, `DumbbellIcon`, `ArrowRightIcon` in `frontend/src/components/icons.tsx`.
- Both pages already have their own `useToast()` instance and render `{Toast}` — see `PlanList.tsx`'s existing `const { Toast, showToast } = useToast();` pattern.

## Requirements

1. **Build one shared component**, e.g. `frontend/src/components/PlanActionCards.tsx`, so the quick-start logic (including the `409` handling) isn't duplicated between Dashboard and Plans. It should:
   - Be self-contained: manage its own `quickStarting`/loading state, its own `useToast()` instance, and render its own toast — so it can be dropped into any page with no prop wiring beyond maybe an optional callback.
   - Render the "What would you like to do today?" heading, then the two cards per the mockup.
   - Left card ("Plan Everything Upfront"): `ClipboardIcon`, heading, description, "Create Plan →" button (with `ArrowRightIcon` or the arrow glyph already used elsewhere) that navigates to `/workout-plans/new`.
   - Right card ("Start Small. Build Over Time ⭐"): `DumbbellIcon`, heading (include the star, matching mockup — a plain "⭐" glyph is fine, check if a star icon already exists in `icons.tsx` first and prefer that for consistency), description, "Start Today →" button that triggers the same quick-start flow as today's `handleQuickStart` (call `workoutSessionsApi.quickStart()`, on `409` toast + redirect to `/dashboard`, otherwise navigate to `/workout-sessions/{session_id}`, disable the button and show a loading label while in flight).
   - Match the mockup's visual treatment: dashed borders, blue vs. green color coding, rounded icon badges, full-width colored CTA buttons. Use existing CSS variables/classes where they already express these colors (check `App.css`/global styles for existing blue/green/success/accent tokens before inventing new ones).

2. **Replace `PlanList.tsx`'s current create-tile + quick-start-link** (lines 116-128) with `<PlanActionCards />`. Remove the now-unused `handleQuickStart`, `quickStarting` state, and related imports if fully superseded by the shared component (verify nothing else in the file still depends on them first).

3. **Replace `Dashboard.tsx`'s current create-tile** (lines 70-76) with `<PlanActionCards />` as well. This gives Dashboard a quick-start entry point it didn't have before — intentional, per the request.

4. Both pages keep their own page-level heading/kicker (Dashboard's "Welcome back / {name}", Plans' "Your ledger / Workout Plans") — only the action-card section itself is shared/replaced.

## Do NOT
- Do not change quick-start's underlying behavior (still subject to the Task 28 unresolved-session block, still calls the same `/workout-sessions/quick-start` endpoint) — this task is presentation-only.
- Do not remove or change the "Saved plans" list below the cards on the Plans page, or the "Recent workouts" list on Dashboard — only the action-card area above them changes.
- Do not duplicate the quick-start/409-handling logic separately in `Dashboard.tsx` and `PlanList.tsx` — it must live once, in the shared component.

## Acceptance criteria
- [ ] Dashboard now shows both cards ("Plan Everything Upfront" and "Start Small. Build Over Time") in place of the old single create-plan tile.
- [ ] Plans page shows the same two cards in place of the old create-plan tile + small text link.
- [ ] Clicking "Create Plan →" on either page navigates to `/workout-plans/new`, same as before.
- [ ] Clicking "Start Today →" on either page starts a quick workout and navigates into it, same as the old "Or log today's workout" link did.
- [ ] With an unresolved session already pending, clicking "Start Today →" on either page shows the toast and redirects to `/dashboard` (matching existing 409 behavior) — test from both pages, not just Plans.
- [ ] No TypeScript errors; no dead/unused code left behind in `PlanList.tsx` from the removed inline quick-start logic.

## Review checklist
- [ ] Quick-start logic exists in exactly one place (the shared component), not copy-pasted into both pages.
- [ ] Visual styling reasonably matches the reference mockup (dashed borders, color-coded cards, icon badges) using existing design tokens/classes where they already exist rather than one-off inline styles, where practical.
- [ ] No regression to Task 28/29's session-lifecycle behavior (409 blocking, discard/resume/finish flows) — this task only touches how the entry points are presented.
