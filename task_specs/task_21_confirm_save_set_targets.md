# Task 21 — Confirm dialog before "Save set targets"

## Objective
Clicking "Save set targets" in Plan Builder's "Vary by set" panel currently saves immediately with no confirmation. Add a confirm dialog first, matching the pattern already used elsewhere in this file (e.g. delete exercise, leave plan creation).

## Context
- File: `frontend/src/features/workoutPlans/PlanBuilder.tsx`.
- The existing confirm-dialog pattern in this file (reuse it exactly): a piece of state holding what's pending + `isOpen`, a `<ConfirmDialog>` rendered once near the bottom of the component, `onConfirm` does the actual action, `onCancel` resets the state. See the delete-exercise dialog (~line 1413-1427):
  ```tsx
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; type: 'exercise' | 'day'; dayId?: number; exerciseId?: number }>({ isOpen: false, type: 'day' });
  ...
  <ConfirmDialog
    isOpen={deleteConfirm.isOpen}
    title="Remove Exercise"
    message="Are you sure you want to remove this exercise?"
    confirmText="Delete"
    cancelText="Cancel"
    isDangerous={true}
    onConfirm={() => { if (deleteConfirm.type === 'exercise' && deleteConfirm.exerciseId) handleRemoveExercise(deleteConfirm.exerciseId); }}
    onCancel={() => setDeleteConfirm({ isOpen: false, type: 'day' })}
  />
  ```
- The current "Save set targets" button (~line 1141-1171) does the save directly in its `onClick`:
  ```tsx
  <button
    onClick={async () => {
      if (planId) {
        setSavingSetTargets((prev) => new Set([...prev, ex.id]));
        try {
          await replaceSetTargets(planId, currentDay.id, ex.id, perSetEdits);
          showToast('Set targets saved!', 'success');
          setVaryBySetRows((prev) => { const updated = new Set(prev); updated.delete(ex.id); return updated; });
          await loadPlanForEdit();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) { setError((err as Error).message); }
        finally { setSavingSetTargets((prev) => { const updated = new Set(prev); updated.delete(ex.id); return updated; }); }
      }
    }}
    className="btn btn-primary set-save-button"
    disabled={isLinkedWeek || savingSetTargets.has(ex.id)}
  >
    {savingSetTargets.has(ex.id) ? 'Saving...' : 'Save set targets'}
  </button>
  ```
- Since multiple exercises' "Vary by set" panels can be open simultaneously (`varyBySetRows` is a `Set<number>`, same reasoning already established for `savingSetTargets` in Task 13), the confirm-pending state needs to track *which* exercise's save is pending — not a single shared boolean.

## Requirements
1. Add state: `const [saveTargetsConfirm, setSaveTargetsConfirm] = useState<{ isOpen: boolean; exerciseId: number | null; dayId: number | null }>({ isOpen: false, exerciseId: null, dayId: null });`
2. Change the "Save set targets" button's `onClick` to just open the confirm dialog instead of saving directly: `onClick={() => setSaveTargetsConfirm({ isOpen: true, exerciseId: ex.id, dayId: currentDay.id })}`. Keep the button's existing `disabled`/label logic (`isLinkedWeek || savingSetTargets.has(ex.id)`) as-is.
3. Move the actual save logic (everything currently in the `onClick`) into a new function, e.g. `handleConfirmSaveSetTargets()`, that reads `saveTargetsConfirm.exerciseId`/`dayId`, looks up that exercise's current edits via `perSetEditsByExerciseId.get(exerciseId)`, and performs the same sequence (save → toast → scroll → collapse panel → reload), then resets `saveTargetsConfirm` to closed. On error, still call `setError(...)` and also close the dialog (don't leave it stuck open on failure).
4. Add a `<ConfirmDialog>` near the other ones (~line 1413 area), e.g.:
   ```tsx
   <ConfirmDialog
     isOpen={saveTargetsConfirm.isOpen}
     title="Save set targets?"
     message="This will save your per-set overrides for this exercise."
     confirmText="Save"
     cancelText="Cancel"
     onConfirm={handleConfirmSaveSetTargets}
     onCancel={() => setSaveTargetsConfirm({ isOpen: false, exerciseId: null, dayId: null })}
   />
   ```
   (`isDangerous` should be omitted/false — this isn't a destructive action, matches the styling of the non-dangerous "Save this plan?" dialog already in this file.)

## Do NOT
- Do not add a confirm dialog to the main "Save Plan"/"Done" button or anywhere else — scoped strictly to "Save set targets".
- Do not change the underlying save behavior (API call, toast, scroll-to-top from Task 13, panel collapse, reload) — only gate it behind a confirmation click first.
- Do not block multiple exercises from having independent pending confirmations if a trainer somehow triggers two saves in quick succession across different exercise panels — the `exerciseId`/`dayId`-keyed state (not a bare boolean) already handles this correctly by design; just don't regress it back to a shared boolean.

## Acceptance criteria
- [ ] Open "Vary by set" on an exercise, edit a value, click "Save set targets" — a confirm dialog appears ("Save set targets?" / Save / Cancel), the save has NOT happened yet.
- [ ] Click "Cancel" — dialog closes, nothing was saved (reload the plan and confirm the edit wasn't persisted), the "Vary by set" panel is still open with your edits still there.
- [ ] Click "Save" — the save proceeds exactly as before (button showed "Saving...", toast appears, page scrolls to top, panel collapses, values persist on reload) — all of Task 13's fixes still work, just gated behind the extra confirm step now.
- [ ] Open "Vary by set" on two different exercises at once, click "Save set targets" on the first one — only that exercise's confirm dialog is relevant; the second exercise's panel/save button is unaffected.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: confirm → cancel → confirm → save flow actually clicked through in a real browser session, including checking that Cancel truly does not persist anything.
