# Task 23 — Remove the "Save set targets" confirm dialog, use button-state feedback instead

**Reverts Task 21's confirm-dialog approach.** The owner tried it and doesn't want a confirmation step — save should happen immediately on click, with feedback shown by the button itself changing state, not a dialog or (implicitly) the toast.

## Objective
Clicking "Save set targets" should save immediately (no confirm dialog). On success, the button should visibly flip to a "Saved" state (label + a lighter/muted color change) for a brief moment, then the panel should close on its own. If the panel is reopened later, the button must be back to its normal "Save set targets" state — the "Saved" state is not sticky.

## Context
- File: `frontend/src/features/workoutPlans/PlanBuilder.tsx`.
- Task 21 added: `saveTargetsConfirm` state, a `<ConfirmDialog>` gating the save, and `handleConfirmSaveSetTargets()` as the actual save logic, triggered only after confirming.
- Before Task 21 (Task 13/13b), the button's `onClick` saved directly and on success called `showToast('Set targets saved!', 'success')`, collapsed the panel via `setVaryBySetRows` delete, called `loadPlanForEdit()`, then `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- `savingSetTargets: Set<number>` (Task 13) already tracks per-exercise in-flight saves and is used for the button's disabled state and "Saving..." label — reuse the same per-exercise-Set pattern for the new "just saved" state, since multiple exercises' panels can be open at once (established repeatedly in this project).

## Requirements
1. **Remove the confirm dialog entirely**: delete the `saveTargetsConfirm` state, the `<ConfirmDialog>` instance added for it (~line 1455-1464), and `handleConfirmSaveSetTargets` as a separate confirm-gated function — fold its body back into the button's `onClick` directly (or keep it as a named function called directly from `onClick`, whichever is cleaner, but no dialog in between).
2. **Add a "just saved" state**: `const [savedSetTargets, setSavedSetTargets] = useState<Set<number>>(new Set());` (same shape as `savingSetTargets`).
3. **New save flow** in the button's `onClick`:
   - Add `ex.id` to `savingSetTargets` (as today), call `replaceSetTargets(...)`.
   - On success: remove `ex.id` from `savingSetTargets`, add `ex.id` to `savedSetTargets` (button now shows "Saved" state).
   - Wait briefly (e.g. `await new Promise(r => setTimeout(r, 700))` — enough for the user to register the state change) before proceeding.
   - Then collapse the panel (`setVaryBySetRows` delete, as today) and call `loadPlanForEdit()`.
   - Remove `ex.id` from `savedSetTargets` once the panel is collapsed (cleanup — doesn't matter much visually since the panel/button is gone, but keeps state tidy for when the panel reopens).
   - On error: keep existing `setError(...)` behavior, and make sure `ex.id` is removed from both `savingSetTargets` and `savedSetTargets` in a `finally`/catch path so the button doesn't get stuck.
4. **Button rendering**: three states now —
   - Default: label "Save set targets", normal `btn btn-primary` styling.
   - Saving (`savingSetTargets.has(ex.id)`): label "Saving...", disabled — unchanged from today.
   - Just saved (`savedSetTargets.has(ex.id)`): label "Saved" (or "✓ Saved"), a visibly lighter/muted color variant (e.g. a lighter shade of the primary color, or swap to a secondary/muted button class — pick whatever's simplest given existing CSS classes in `App.css`; doesn't need a new class if an existing muted/secondary style fits, but should read as clearly "different from the normal active button" at a glance), still disabled (can't click "Saved" to re-save while it's showing).
5. **Reset on reopen**: since `savedSetTargets` only ever contains `ex.id` for the few hundred ms between save-success and panel-collapse, and the panel is gone by the time a user could reopen it, this should already naturally "reset" — verify this holds live (the requirement is explicit: reopening the panel must show the normal "Save set targets" button, not "Saved").
6. Remove the `showToast('Set targets saved!', 'success')` call and the `window.scrollTo({ top: 0, behavior: 'smooth' })` call for this specific save action — the button-state change is now the sole feedback mechanism, per the owner's request. (Toast/scroll usage elsewhere in the file, e.g. plan rename, exercise add, is untouched.)

## Do NOT
- Do not remove `savingSetTargets` or its existing "Saving..." behavior — only adding a new state alongside it.
- Do not touch the toast/scroll behavior for any other action in this file (plan rename, add exercise, etc.) — scoped strictly to the set-targets save flow.
- Do not re-add any confirmation step — this task's whole point is removing it.

## Acceptance criteria
- [ ] Open "Vary by set", edit a value, click "Save set targets" — no dialog appears, save happens immediately.
- [ ] Button shows "Saving..." briefly, then flips to a visibly different "Saved" state (lighter/muted color) for roughly half a second to a second.
- [ ] After that beat, the panel closes on its own (collapses back to the normal row view).
- [ ] Reopen "Vary by set" on the same exercise — the button shows normal "Save set targets" (not stuck on "Saved").
- [ ] Reload the plan (or check via API) — the edited values persisted correctly, same as Task 13/21 already verified.
- [ ] Two different exercises' panels open at once, save one — only that one shows "Saving..." → "Saved"; the other exercise's button is untouched.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: the full click → "Saving..." → "Saved" (visibly different color) → auto-close → reopen-resets-to-normal cycle, actually observed in a real browser session, not just read from code.
