# Task 85 — Replace Quick Workout's manual "Add Exercise" box with the exercise library

## Objective
Quick-start plans let you add exercises live, mid-workout (`ActiveWorkout.tsx`, gated on `isQuickStart`). Today that's a bare text input (`ActiveWorkout.tsx:1479-1526`) — you type the exact exercise name blind, with no search, no browsing by muscle group, no thumbnails, and no preview before adding. It matches by exact case-insensitive name against `availableExercises`, or silently creates a brand-new exercise if nothing matches (`handleAddExerciseToDay`, `ActiveWorkout.tsx:518-553`).

This task replaces that with `ExerciseLibrarySidebar` — the same component Plan Builder already uses for exactly this purpose — wired the same way Plan Builder wires it: **always-visible column on desktop, full-screen modal on mobile**. Preview reuses Active Workout's own existing preview mechanism (the `ExerciseWorkoutPreview` component + desktop side panel / mobile `Modal fullScreen`), generalized to also work for library exercises that aren't in the workout yet.

Also fixes the default set count for newly quick-added exercises: **1 set, not 3** (see below).

## Where quick-added exercises are stored (confirmed, no schema change)
No new table. Exercises picked from the library, or newly typed as custom, land in the same per-user `exercises` table Plan Builder already uses, with `is_custom: false` — same reasoning as Plan Builder's existing comment ("so it doesn't pollute the Custom Exercises tab"). The separate `exercise_library` table is the shared, read-only catalog used only for the sidebar's search/browse — unchanged, not touched by this task.

## Required changes

### `frontend/src/features/sessions/ActiveWorkout.tsx`

**1. Generalize the preview state.** Currently `previewingExerciseId: number | null` (~line 109) is looked up against `planExercises` to build the preview (desktop panel: lines 1362-1405; mobile modal: lines 1408-1429) — this only works for exercises already in the workout. Replace it with `selectedPreview: SelectedExerciseInfo | null` (import the `SelectedExerciseInfo` type from `../exerciseLibrary/ExerciseLibrarySidebar`, mirroring `PlanBuilder.tsx`'s own `selectedPreview` state exactly):
   - Wherever a plan-exercise's preview is currently triggered (the `onClick`/`aria-label={\`Preview ${exerciseName}\`}` handler that sets `previewingExerciseId(we.id)`), change it to `setSelectedPreview({ name: exerciseName, video_url: selectedExercise.video_url || null, muscle_group: selectedExercise.muscle_group || null, equipment: selectedExercise.equipment || null })`.
   - The desktop preview panel (~1362-1405) and mobile preview modal (~1408-1429) should render directly from `selectedPreview` instead of re-deriving it via `planExercises.find(...)`.
   - This is the exact same shape/pattern already used by Plan Builder's `selectedPreview` + `ExercisePreviewPanel` — but keep using Active Workout's own `ExerciseWorkoutPreview` component (already fixed for mobile sizing and video playback in prior work), not Plan Builder's `ExercisePreviewPanel`. Do not import or introduce `ExercisePreviewPanel` here.

**2. Add the library sidebar — desktop (always-visible).** Only rendered when `isQuickStart && !isMobile` (this feature only exists for quick-start plans, matching the current gating). Add a persistent column the same way Plan Builder lays out its sidebar: wrap the page in a root `display: flex` container with the existing `page-container` as the flex-1 main column and a new `320px` fixed-width column alongside it containing `<ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} onExerciseCreated={handleExerciseCreated} onPreviewExercise={(info) => setSelectedPreview(info)} />`. Reference Plan Builder's exact structure (`PlanBuilder.tsx`'s outer return and its sidebar column near the end of the component) for the layout pattern.

**3. Add the library — mobile (full-screen modal).** Replace the current "+ Add Exercise" button + inline text form (~1517-1526 for the button, ~1481-1516 for the form) with: a "+ Add Exercise" button that opens a new `showExercisePicker` boolean state, rendering `<Modal isOpen={showExercisePicker} onClose={() => setShowExercisePicker(false)} title="Add Exercise" fullScreen={true}><ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} onExerciseCreated={handleExerciseCreated} onPreviewExercise={(info) => { setSelectedPreview(info); setShowPreviewModal... }} /></Modal>` — mirror Plan Builder's mobile exercise-picker modal (`PlanBuilder.tsx` ~2213-2225) exactly, including how it separately handles a preview-within-the-picker (Plan Builder opens a second modal/screen for preview when picking on mobile — check how `handlePreviewExercise` branches on `isMobile` there and replicate it).

**4. Replace `handleAddExerciseToDay` with `handleQuickAddExercise`.** Remove the old handler and its state (`addExerciseName`, `isAddingExercise`, `addingExercise`). New handler mirrors Plan Builder's `handleQuickAddExercise` (`PlanBuilder.tsx:676-696`) exactly, including its double-tap guard:
   ```ts
   const pendingAddsRef = useRef<Set<string>>(new Set());

   async function handleQuickAddExercise(exerciseInfo: SelectedExerciseInfo) {
     const key = exerciseInfo.name.toLowerCase();
     if (pendingAddsRef.current.has(key)) return;
     pendingAddsRef.current.add(key);
     try {
       // find-or-create in availableExercises, is_custom: false — same logic
       // currently in handleAddExerciseToDay, lines 524-536 — reuse it, don't
       // rewrite the find-or-create logic from scratch.
       // Then: await addExerciseToDay(planId, dayId, exerciseId, 1, undefined, undefined, undefined, true, true, false);
       // — note the explicit `1` for targetSets (see point 5) and explicit
       // has_reps/has_weight/has_duration matching Plan Builder's own quick-add defaults.
       showToast(`${exerciseInfo.name} added!`, 'success');
       if (onPlanDetailRefresh) await onPlanDetailRefresh();
     } catch (err) {
       setError((err as Error).message);
     } finally {
       pendingAddsRef.current.delete(key);
     }
   }
   ```
   Add `handleExerciseCreated` too (mirrors Plan Builder's — adds a newly-created exercise into `availableExercises` so a rapid second add of the same exercise doesn't trigger a duplicate create; Plan Builder already has this exact function, copy the pattern).

**5. Fix the default set count.** Line 276: `we.target_sets ?? 3` → `we.target_sets ?? 1`. Also make sure the new `handleQuickAddExercise`'s call to `addExerciseToDay` explicitly passes `1` for `targetSets` (see point 4) rather than leaving it `undefined` and relying on this fallback — the fallback should only ever matter for legacy/edge-case null data going forward, not be the primary mechanism, matching how Plan Builder's own quick-add already explicitly persists `1`.

## Do NOT
- Do not change anything for non-quick-start plans — this entire feature (add-exercise-mid-workout) only exists when `isQuickStart` is true, and that gating must not change.
- Do not import or use Plan Builder's `ExercisePreviewPanel` — reuse Active Workout's existing `ExerciseWorkoutPreview` for both the desktop panel and mobile modal, per the user's explicit instruction that preview should work "like the current start workout preview."
- Do not touch the `isConfigurable`/set-count-configuration behavior for newly-added exercises with zero logged sets (~line 1098) — that's unrelated to how the exercise gets added, only to what happens after.
- Do not change the `exercise_library` table, `exerciseLibraryApi`, or `ExerciseLibrarySidebar` itself — reuse it as-is, exactly as Plan Builder does.
- Do not add a new database table for quick-added exercises — confirmed above, they use the existing `exercises` table.

## Required tests
Per current testing policy:
- Desktop: `ExerciseLibrarySidebar` renders as an always-visible column when `isQuickStart` is true (no button click needed to reveal it), and does not render at all when `isQuickStart` is false.
- Mobile: the sidebar is not visible by default; tapping "+ Add Exercise" opens it in a full-screen modal; closing the modal hides it again.
- Selecting an exercise from the library calls `addExerciseToDay` with `targetSets: 1` explicitly (the regression test for the set-count default fix).
- Rapid double-selection of the same exercise (simulating a double-tap) only triggers one `addExerciseToDay`/create call — regression test for the double-tap guard, mirroring the equivalent existing Plan Builder test/fix.
- Clicking preview on an exercise already in the workout, and clicking preview on a library exercise not yet added, both populate the same preview panel/modal (`ExerciseWorkoutPreview`) — assert both code paths feed the same `selectedPreview` state/rendering, not two different mechanisms.
- `we.target_sets ?? 1` regression test: an exercise with `target_sets: null` shows 1 pip/set, not 3.

## Acceptance criteria
- [ ] Quick Workout's "Add Exercise" experience matches Plan Builder's: searchable library, muscle-group filtering, thumbnails, Custom Exercises tab, always-visible sidebar on desktop, full-screen modal on mobile.
- [ ] Preview (both for exercises already in the workout and for library exercises being browsed) uses Active Workout's own `ExerciseWorkoutPreview` mechanism — correct mobile full-screen sizing and working video playback, per the two most recent fixes.
- [ ] A newly quick-added exercise defaults to 1 set, not 3.
- [ ] Quick-added exercises are stored in the existing `exercises` table with `is_custom: false` — confirm via a live check (or test) that they do not appear in the Custom Exercises tab.
- [ ] Full frontend test suite passes including new tests; `npx tsc -b` clean. Backend untouched — confirm zero backend file diffs (this is a frontend-only reuse of existing endpoints).

## Review checklist
- [ ] Confirm the old `addExerciseName`/`isAddingExercise`/`addingExercese`/`handleAddExerciseToDay` code was fully removed, not left dead alongside the new sidebar.
- [ ] Confirm `selectedPreview` is a single unified state feeding both the "click an existing workout exercise" and "preview from the library" paths — not two parallel preview mechanisms bolted together.
- [ ] Live-verify on both desktop and mobile viewports: start a quick workout, confirm the sidebar/modal appearance matches Plan Builder's, add an exercise via search, verify it lands with 1 set, and preview both an existing and a not-yet-added exercise.
