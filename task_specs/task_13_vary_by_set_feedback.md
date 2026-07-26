# Task 13 — "Save set targets" feedback + panel repositioning

## Objective
When a trainer clicks "Save set targets" in the Plan Builder's "Vary by set" panel, make it unambiguous that the save happened, and stop leaving the view in an awkward scroll position afterward.

## Context
- File: `frontend/src/features/workoutPlans/PlanBuilder.tsx`, the "Save set targets" button is around line 1048-1069:
  ```tsx
  <button
    onClick={async () => {
      if (planId) {
        try {
          await replaceSetTargets(planId, currentDay.id, ex.id, perSetEdits);
          showToast('Set targets saved!', 'success');
          setVaryBySetRows((prev) => {
            const updated = new Set(prev);
            updated.delete(ex.id);
            return updated;
          });
          await loadPlanForEdit();
        } catch (err) {
          setError((err as Error).message);
        }
      }
    }}
    className="btn btn-primary set-save-button"
    disabled={isLinkedWeek}
  >
    Save set targets
  </button>
  ```
- `showToast` comes from `useToast()` (`frontend/src/components/Toast.tsx`), and `{Toast}` is already rendered unconditionally near the bottom of `PlanBuilder.tsx` (lines 656 and 1341 — both return branches include it), so the toast mechanism itself is wired correctly elsewhere in this file.
- Note: in a prior debugging session we confirmed via careful polling that this exact toast call *does* fire and render — the earlier "no feedback" report may have been a timing/positioning issue (the panel collapses via `setVaryBySetRows` delete in the same click, then `loadPlanForEdit()` re-renders the whole day, which could visually yank the toast out of view or make it easy to miss if the user's eyes are on the panel that just disappeared, not the corner where the toast renders) rather than the toast simply not firing. Reproduce live first before assuming the toast itself is broken.
- The current button has no `disabled` state tied to the async operation itself (only `isLinkedWeek`), so rapid double-clicks or a slow network could cause a duplicate save without visual feedback that a save is in progress.

## Requirements
1. **Loading state on the save button**: track a per-exercise (or single, since only one panel can reasonably be open/saving at a time — use your judgement, simplest correct option) `savingSetTargets` boolean. While saving, disable the button and change its label to "Saving..." (matching the pattern used elsewhere in this file, e.g. `renamingPlan ? "Saving..." : "Save"` for the plan name save button).
2. **Make the success toast unmissable**: after a successful save, in addition to `showToast(...)`, scroll the toast (or at minimum the top of the page / the exercise row that was just saved) into view so the user's eyes land where the confirmation shows. Simplest correct approach: after `showToast(...)` fires, call `window.scrollTo({ top: 0, behavior: 'smooth' })` (Toast renders `position: fixed; bottom: 20px; right: 20px`, per `Toast.tsx`, so it's always in the viewport regardless of scroll position — but if the panel itself was scrolled far down, scrolling the page brings the corner toast plus the collapsed row back into view together). Confirm this is enough by reproducing the original report live; if scrolling to top doesn't fix a real repositioning issue, investigate what specifically shifts (e.g. does `loadPlanForEdit()` change `activeDayIndex` or day tab layout?) and fix that root cause instead.
3. Keep the existing order of operations (save → toast → collapse panel → reload) unless live reproduction shows the *order* itself is the bug — e.g. if collapsing the panel before the toast renders is what hides the feedback, consider firing the toast and reload first, then collapsing the panel on a short delay (or after `loadPlanForEdit()` resolves) so the user sees the saved values settle before the panel disappears.
4. Apply the same treatment consistently — don't special-case only one exercise's panel.

## Do NOT
- Do not change the underlying `replaceSetTargets` API call or its payload shape.
- Do not remove the panel-collapse behavior — collapsing after a successful save is intentional, just make sure the user perceives success first.
- Do not add a browser `alert()`/`confirm()` — use the existing toast system.

## Acceptance criteria
- [ ] Open a plan in Plan Builder, click "Vary by set" on an exercise, edit a set's reps/weight, click "Save set targets" — button shows a saving/disabled state briefly, then a green "Set targets saved!" toast is clearly visible without the user needing to scroll or look away from where their attention already is.
- [ ] Scroll the page down first (e.g. resize to a small viewport or scroll to a lower exercise) before saving, to reproduce the original "dropdown in a weird position" report, and confirm the fix addresses it.
- [ ] Reload the plan after saving — the saved per-set values persist (this already works via `loadPlanForEdit()`; just confirm no regression).
- [ ] Rapid double-click on "Save set targets" does not cause duplicate API calls (button is disabled while saving).

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] No console errors on save.
- [ ] The fix was verified against a live reproduction of the original complaint, not just code-reviewed — screenshot or DOM-geometry proof (e.g. `getBoundingClientRect()` on the toast element showing it's within the viewport) required in the completion report.
