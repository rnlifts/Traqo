# Task 24 — Make "Vary by set" work when creating a plan for the first time

## Objective
"Vary by set" works correctly when editing an existing plan, but does nothing when creating a brand-new plan. Fix both the frontend (the save button silently no-ops) and the backend (per-set overrides aren't even accepted by the plan-creation endpoint).

## Root cause (confirmed by reading the code — two separate gaps, both needed)

**1. Frontend: the "Save set targets" button only knows how to save to an existing plan.**
`frontend/src/features/workoutPlans/PlanBuilder.tsx` — during plan creation, `planId` is hardcoded to `null` (line 72: `const planId = props.isCreateMode ? null : (props as EditPlanBuilderProps).planId;`), because there's no backend plan/day id yet — the whole plan is submitted atomically at the end via `buildPlan()`. But the "Save set targets" button's `onClick` is gated by `if (planId && !isLinkedWeek)` and calls `replaceSetTargets(planId, currentDay.id, ex.id, ...)` — an API call that needs a real plan/day id. In create mode, `planId` is always falsy, so the entire block is skipped: no save, no error, no visible feedback, no panel close. The button is just dead.

**2. Backend: even if the frontend called something, per-set overrides have nowhere to go during plan creation.**
- `BuildPlanExerciseRequest` (`backend/src/modules/workouts/presentation/schemas.py`) has no `set_targets` field at all.
- The route handler `/workout-plans/build` (`backend/src/modules/workouts/presentation/routes.py`, ~lines 247-307) builds plain dicts per exercise for the use case, with no `set_targets` key.
- `BuildPlan.execute()`'s `_build_days_plan`/`_build_weeks_plan` (`backend/src/modules/workouts/application/use_cases/build_plan.py`) construct `WorkoutExerciseModel` rows directly and never touch `WorkoutExerciseSetTargetModel` at all.

So this needs an end-to-end fix, backend first (so the frontend has something to send to).

## Requirements

### Backend
1. `backend/src/modules/workouts/presentation/schemas.py`: add `set_targets: list[SetTargetRequest] = []` to `BuildPlanExerciseRequest`.
2. `backend/src/modules/workouts/presentation/routes.py`, `/workout-plans/build` handler: in both dict-construction blocks (days branch ~line 247-268, weeks branch ~line 275-307), add `"set_targets": [st.dict() for st in ex.set_targets]` to each exercise dict.
3. `backend/src/modules/workouts/application/use_cases/build_plan.py`:
   - Import `WorkoutExerciseSetTargetModel` from `...infrastructure.models.workout_exercise_set_target_model`.
   - In `_build_days_plan` (~line 175-189) and `_build_weeks_plan` (~line 279-293): after `self.db.add(exercise_model)`, call `self.db.flush()` to get `exercise_model.id` (not currently flushed per-exercise — only per-day/per-week), then for each entry in `exercise_spec.get("set_targets", [])`, add a `WorkoutExerciseSetTargetModel(workout_exercise_id=exercise_model.id, set_number=st["set_number"], target_reps=st.get("target_reps"), target_weight=st.get("target_weight"), target_duration_seconds=st.get("target_duration_seconds"))` and `self.db.add(...)` it. Skip if the list is empty (no extra flush needed in that case, though an unconditional flush is harmless too — use your judgement for the cleanest code).
   - The final `self.db.commit()` at the end of each method already covers these new rows — no other transaction changes needed.

### Frontend
4. `frontend/src/features/workoutPlans/PlanBuilder.tsx`, `handleSavePlan()` (~line 237-309): in both the `days` branch (~line 257-272) and the `weeks` branch (~line 280-295), add `set_targets: perSetEditsByExerciseId.get(ex.id) || []` to each exercise object in the payload — this is what actually gets the trainer's per-set edits into the final `buildPlan()` call.
5. The "Save set targets" button's `onClick` (~line 1142-1185): add a create-mode path. Since draft edits already live entirely in `perSetEditsByExerciseId` (local state, no backend round-trip needed until the whole plan is submitted), this path doesn't need to call any API:
   ```tsx
   onClick={async () => {
     if (props.isCreateMode && !isLinkedWeek) {
       // Draft-only: the edits are already in perSetEditsByExerciseId; just show
       // the same "Saved" feedback and close, matching Task 23's edit-mode UX.
       setSavedSetTargets((prev) => new Set([...prev, ex.id]));
       await new Promise(r => setTimeout(r, 700));
       setVaryBySetRows((prev) => { const updated = new Set(prev); updated.delete(ex.id); return updated; });
       setSavedSetTargets((prev) => { const updated = new Set(prev); updated.delete(ex.id); return updated; });
       return;
     }
     if (planId && !isLinkedWeek) {
       // existing edit-mode logic, unchanged
       ...
     }
   }}
   ```
   (Exact structure is illustrative — fit it into the existing function shape used by Task 23, just add the create-mode branch before/alongside the existing `planId` branch. No "Saving..." state is needed for the create-mode path since there's no network call — jumping straight to "Saved" is fine, but match whatever reads cleanest against the existing button label logic from Task 23.)
6. Verify draft exercises' `set_targets` field already defaults to `[]` on creation (confirmed at ~line 414, `set_targets: []`) — this means the existing "seed Set 1 from main row" logic (Task 14b) already works correctly for create-mode exercises with no extra changes needed there.

## Do NOT
- Do not change how `perSetEditsByExerciseId` is seeded/synced (Tasks 14/14b/19/19b logic) — this task only wires the existing draft state into the final submission and fixes the button's create-mode no-op.
- Do not add a separate backend endpoint for saving set-targets mid-creation — plan creation stays atomic (everything submitted together via `buildPlan()`), consistent with how every other field (reps/weight/duration/has_*) already works during creation.
- Do not touch the edit-mode save path (Task 21/23's logic) — it already works correctly, this task only adds the missing create-mode branch alongside it.

## Acceptance criteria
- [ ] Start creating a new plan (not editing an existing one). Add an exercise, set target Sets/Reps/Weight. Click "Vary by set", edit Set 2's values differently from Set 1. Click "Save set targets" — button shows the "Saved" state briefly (Task 23's UX), panel closes. No console errors.
- [ ] Continue building the plan and click through to final "Save"/"Done" (submitting via `buildPlan()`). 
- [ ] After the plan is created, open it in edit mode (or check via `GET /workout-plans/{id}`) — the per-set overrides you set during creation are actually there (Set 1 and Set 2 show their distinct saved values, not blank or uniform).
- [ ] Start a workout from this newly-created plan — each set's panel prefills from its own per-set override (same verification pattern as Task 19's last criterion), confirming the data survived the full create → build → start-workout round trip.
- [ ] Editing an existing plan (Task 21/23's flow) is completely unaffected — still works exactly as already verified.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: full plan creation flow with vary-by-set, submitted, reloaded, and started as a workout — not just read from code. This is a multi-step round trip (create → build → GET → start session), so don't skip any of the steps when verifying.
