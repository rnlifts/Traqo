# Task 31 — Polish pass on the plan-length picker (Task 30 follow-up)

## Objective
Refine the days-first/multi-week picker built in Task 30 based on product-owner UX feedback: make the multi-week opt-in feel like a real interactive control (not a faint text link), simplify beginner-facing copy, tighten spacing, and adjust wording. Pure UI polish — no new data flows, no changes to the `PlanDraft` contract.

## Context
- Everything lives in `frontend/src/features/workoutPlans/CreatePlanStep1.tsx`, built in Task 30. Read the current file in full before starting — it already has `periodizationMode`, `handleEnablePeriodization`, `handleDisablePeriodization`, `handleSelectDays`, `handleSelectWeeks`, and the two conditional render blocks (`!periodizationMode` / `periodizationMode`).
- **Known correctness fix already applied in Task 30's follow-up**: `handleEnablePeriodization` resets `totalUnits` to `0` (not left over from the days selection) — do not revert this, it fixes a real bug where entering multi-week mode without picking a week length silently created a plan with the wrong week count.
- Product owner's naming decision: keep **"Multi-week plan"** as the feature name (not "Advanced Programming" or similar). "Periodization" is not beginner-facing vocabulary and should not appear until after the user has already opted in.

## Requirements

1. **Replace the toggle mechanism.** Currently entering multi-week mode is a plain text link ("+ Enable multi-week plan") that swaps the whole day-picker section out for the weeks picker. Replace this with a **toggle switch** (an actual switch/checkbox control, not a button) inside the card: label "Create a multi-week training plan", switch defaulting to OFF. Toggling ON reveals the weeks picker (1 Week / 4 Weeks / Custom) in place of — or below — the day-pills, exactly as today's mode-swap already does; toggling OFF reverts to day-pill mode (reuse `handleEnablePeriodization`/`handleDisablePeriodization`'s existing state-reset logic, just triggered by the switch's `onChange` instead of a button `onClick`).
2. **Make the card itself feel clickable.** Style the card with a visible border/background that reads as an interactive element (not just a static info box), and make clicking anywhere on the card body (not just the switch) also toggle it — while making sure clicking the switch itself doesn't double-toggle (stop propagation appropriately, or handle the toggle in one place and have both the card's onClick and the switch's onChange call the same handler without double-firing).
3. **Simplify the default (OFF) copy** — remove "periodization" entirely from what's shown before the toggle is on. Use: heading "Create a multi-week training plan", body "Create a multi-week training plan with different workouts each week." (Do not use the word "periodization" here.)
4. **Introduce "Periodization" only after enabling.** Once the toggle is ON, the section can now show a heading like "Multi-week Training (Periodization)" above the weeks picker — this is the one place "periodization" is allowed to appear, since by this point the user has already opted into the advanced flow.
5. **Tighten the card's padding/spacing.** The current card (lines ~135-165 in the pre-Task-31 version) feels taller than its content needs — reduce vertical padding/margins so it reads as compact, not empty. Use judgment matching the rest of the app's existing density (compare against other cards/panels in the codebase, e.g. `.panel` usage elsewhere).
6. **Update the helper copy** under the day-pills from "You'll create a repeating weekly plan with this schedule." to **"This workout schedule repeats weekly."**

## Do NOT
- Do not reintroduce the `totalUnits` leftover-value bug — toggling into multi-week mode must still reset `totalUnits` so a length must be explicitly chosen before Continue succeeds.
- Do not rename the feature to "Advanced Programming" or anything else — "Multi-week plan" is the locked-in name per product owner decision.
- Do not change the `PlanDraft` interface, `onContinue` contract, or anything in `CreatePlanStep1.tsx` unrelated to this visual polish (validation logic, Cancel/Continue behavior, day-pill defaults, etc. all stay as Task 30 left them).
- Do not touch any file outside `CreatePlanStep1.tsx`.

## Acceptance criteria
- [ ] The multi-week section now shows a real toggle switch, not a text link.
- [ ] Clicking the switch, or clicking elsewhere on the card body, both toggle multi-week mode on/off — without double-toggling when the switch itself is clicked.
- [ ] With the toggle OFF, the card's copy never mentions "periodization."
- [ ] With the toggle ON, "Periodization" appears (e.g. as a parenthetical next to "Multi-week Training"), and the weeks picker (1 Week / 4 Weeks / Custom) shows exactly as it did in Task 30, still requiring an explicit selection before Continue succeeds (retest the Task 30 bug scenario: toggle on, do not pick a length, click Continue → must show "Please select a length to continue.", not silently proceed).
- [ ] Card padding is visibly tighter than before, proportionate to its content.
- [ ] Helper text under the day-pills reads "This workout schedule repeats weekly."
- [ ] Toggling off and back on resets state cleanly (no stale selections carried over incorrectly), same as Task 30's toggle-back behavior.
- [ ] TypeScript compiles with no new errors.

## Review checklist
- [ ] `PlanDraft` shape unchanged.
- [ ] No regression on the Task 30 acceptance criteria (day-pill default of "1 Day", 1-7 day selection, weeks selection including custom 1-52, toggle-back).
- [ ] Toggle switch is keyboard-accessible (space/enter to toggle) if a switch component/pattern already exists elsewhere in the codebase to follow; otherwise a plain accessible `<input type="checkbox">`-based switch is acceptable — don't build a purely mouse-only custom control.
