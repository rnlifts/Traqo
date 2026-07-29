# Task 30 — Redesign the plan-length picker (days-first, periodization opt-in)

## Objective
Replace the current "1 Day / 2 Days / 1 Week / 4 Weeks / Custom" chip picker in plan creation with a simpler days-first picker (1–7 days, repeating weekly), and move multi-week/periodization behind an explicit opt-in for the minority of users who actually need it. Reference mockup provided by the product owner (attached in this task's originating conversation) — match its layout and copy closely.

## Context
- The entire current picker lives in one file: `frontend/src/features/workoutPlans/CreatePlanStep1.tsx`. It produces a `PlanDraft { name, unitType: 'days' | 'weeks', totalUnits: number }` via `onContinue(draft)` — this is the only contract with the rest of the app.
- **No backend or data-model changes are needed.** `unitType: 'days'` with `totalUnits` 1-7 and `unitType: 'weeks'` with `totalUnits` already both exist and are already fully supported end-to-end (the weeks/periodization system is real, working code today — see `PlanBuilder.tsx` and `SessionSetupPage.tsx`'s `unit_type === 'weeks'` branch). This task only changes what's rendered in `CreatePlanStep1.tsx` and how the user arrives at each `unitType`/`totalUnits` combination — the values it produces stay within the same existing contract.
- Current implementation detail worth knowing: `predefinedLengths` (lines 23-28) hard-codes `1 Day`, `2 Days`, `1 Week`, `4 Weeks`; there's also a `showCustom` panel (lines 116-151) with a number input (1-52) and a Days/Weeks toggle. All of this UI is being replaced per the mockup — the underlying `unitType`/`totalUnits` state variables and `handleContinue` validation logic can largely stay, just re-wired to new controls.

## Requirements
Rebuild the "Workout Schedule" section of `CreatePlanStep1.tsx` to match the reference mockup:

1. **Primary picker: 7 day-pills**, labeled "1 Day" through "7 Days", laid out in a single row (wrap on narrow viewports). Selecting one sets `unitType: 'days'`, `totalUnits: <n>`. Section header: "Workout Schedule" with the subheading question "How many days do you plan to work out each week?" Helper text below the pills: "You'll create a repeating weekly plan with this schedule."
2. **Default selection**: "1 Day" pre-selected on mount (matches mockup), not empty/unselected — this changes current behavior where nothing is selected by default.
3. **Periodization opt-in box** below the day-pills, visually distinct (bordered/tinted panel per mockup): heading "Need different workouts each week?", body copy "Create a multi-week training plan (periodization). Plan different exercises or workout blocks for each week.", and a button "+ Enable multi-week plan".
4. **Clicking "Enable multi-week plan"** switches the section into weeks mode: hide the day-pills, show a weeks-length picker in their place. Reuse the existing predefined options (`1 Week`, `4 Weeks`) as pills plus a custom numeric input (1-52) for anything else — this is the same validation range the current custom panel already enforces (lines 48-49), just re-presented. Provide a clear way back, e.g. a text link/button "Use a single repeating week instead" that switches back to day-pill mode and resets `unitType` to `'days'`.
5. Keep the plan-name field, error handling (`isValid`/`error` state), and Cancel/Continue actions exactly as they are today — only the length-selection UI within the panel changes.
6. `handleContinue`'s validation logic can stay conceptually the same (name required, a valid length required) — adapt it to the new state shape rather than rewriting from scratch.

## Do NOT
- Do not touch anything outside `CreatePlanStep1.tsx` — no backend routes, no `PlanBuilder.tsx`, no `SessionSetupPage.tsx`. The weeks/periodization system downstream already works and is untouched by this task.
- Do not remove the ability to create a multi-week plan — it must remain fully reachable via "Enable multi-week plan", just no longer the default first impression.
- Do not change the `PlanDraft` interface or the `onContinue` contract — same shape (`name`, `unitType`, `totalUnits`) must be passed to the parent exactly as before.
- Do not add a day count above 7 to the primary picker — a plan needing more structure than a 7-day repeating week is exactly the periodization use case, which is what the opt-in box is for.

## Acceptance criteria
- [ ] Opening "Create exercise plan" shows the new layout matching the mockup: plan name field, then "Workout Schedule" with 7 day-pills (1 Day pre-selected), helper text, then the periodization opt-in box.
- [ ] Selecting any day-pill (e.g. "4 Days") and continuing creates a plan with `unit_type: 'days'`, the correct day count — verify via the resulting plan's behavior in Plan Builder (should show 4 days to configure, same as today's "custom 4 days" would have).
- [ ] Clicking "Enable multi-week plan" reveals the weeks picker (1 Week / 4 Weeks / custom 1-52) and hides the day-pills.
- [ ] Selecting "4 Weeks" and continuing creates a plan with `unit_type: 'weeks'`, `total_units: 4` — verify it behaves identically to how the old "4 Weeks" chip did (weeks-based Plan Builder UI, week selector in Session Setup, etc. — this is pre-existing behavior, just confirm it's unaffected).
- [ ] Custom weeks input rejects values outside 1-52, matching current validation.
- [ ] The "Use a single repeating week instead" (or equivalent) control switches back to day-pill mode cleanly, without leftover invalid state.
- [ ] Cancel and Continue buttons behave exactly as before (Continue disabled/soft-disabled until name + valid length are set).
- [ ] No TypeScript errors; no changes needed outside `CreatePlanStep1.tsx`.

## Review checklist
- [ ] `PlanDraft` shape passed to `onContinue` is unchanged from before this task.
- [ ] Existing weeks-based plans (created before this change) are unaffected — this is a creation-flow-only change, no migration needed since no data model changed.
- [ ] Copy matches the reference mockup closely (exact wording isn't sacred, but keep the "1 day → default, easy" / "periodization → explicit opt-in for people who know what it means" framing intact).
