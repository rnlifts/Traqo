# Task 22 — Target line shows the currently-relevant set's target, not a "(varies by set)" note

**Supersedes part of Task 20.** Task 20 made the target line respect `has_reps`/`has_weight`/`has_duration` and added a "(varies by set)" suffix when per-set overrides differ — that gating logic stays, but replace the "(varies by set)" mechanic with something more useful: show the specific target for whichever set the user is currently looking at.

## Objective
Under each exercise name in `ActiveWorkout.tsx`, the "Target: ..." line should show **Set 1's target by default**, and switch to show **Set N's target** when the user taps into Set N's logging panel. If the exercise's target never varies across sets (uniform, or no per-set overrides saved), it just always shows that one target — no visible difference from today in that case.

## Context
- File: `frontend/src/features/sessions/ActiveWorkout.tsx`.
- `buildTargetLine(we: WorkoutExercise): string | null` (~line 176-215, from Task 20) currently always sources values from the main row (`we.target_reps`/`we.target_weight`/`we.target_duration_seconds`) and appends `" (varies by set)"` if any `we.set_targets` entry differs.
- `targetLine = buildTargetLine(we)` is called once per exercise card (~line 804), with no set number involved.
- The component already tracks which set's panel is open: `activePanelExerciseId` and `activePanelSetNumber` state (existing, used by `openSetPanel`/`closeSetPanel`).
- Per-set override lookup already exists and is proven correct (Task 19/19b): `we.set_targets?.find((st) => st.set_number === setNumber)`.

## Requirements
1. Change `buildTargetLine` to accept a `setNumber: number` parameter (or compute it internally per-call — either is fine, but the source of truth for which set to show is described in point 2).
2. For the given `setNumber`, look up `we.set_targets?.find((st) => st.set_number === setNumber)`. Build the line using, per field (same `has_*` gating from Task 20):
   - `target_reps`: that set's override if present and non-null, else fall back to `we.target_reps`.
   - `target_weight`: same fallback pattern.
   - `target_duration_seconds`: same fallback pattern, formatted via `secondsToHMS` exactly as Task 20 already does.
   - `target_sets`: unchanged, always from `we.target_sets` (not per-set).
3. Remove the "(varies by set)" detection/suffix logic entirely — showing the actual set-specific target makes it unnecessary.
4. At the call site (~line 804), determine which set number to pass:
   - If `activePanelExerciseId === we.id && activePanelSetNumber !== null`, use `activePanelSetNumber`.
   - Otherwise (no panel open for this exercise, or a different exercise's panel is open), default to `1`.
5. Since `targetLine` now depends on which panel is open, it needs to be recomputed on every render where that state changes — it already is, since `targetLine = buildTargetLine(we)` runs inside the `.map()` on every render; just make sure the new set-number argument is threaded through correctly so it's live (no memoization that would go stale).

## Do NOT
- Do not change `openSetPanel`/`closeSetPanel` or the per-set override lookup logic used there — this task only affects the summary line's data source, not the actual panel's prefill (already correct).
- Do not add this set-aware behavior to Plan Builder — it still has no summary line (per Task 20, out of scope there).
- Do not change what determines `has_reps`/`has_weight`/`has_duration` gating — keep that exactly as Task 20 implemented it, just apply it per-set now instead of per-exercise-uniform.

## Acceptance criteria
- [ ] Exercise with varying per-set targets (e.g. Set 1 reps "8", Set 2 reps "12", Set 3 reps "10") and no panel open — target line shows Set 1's target ("8 reps").
- [ ] Tap Set 2's pip (opening its panel) — target line updates live to show Set 2's target ("12 reps"), not "(varies by set)".
- [ ] Tap Set 3's pip — target line updates to show Set 3's target ("10 reps").
- [ ] Close the panel (tap the same pip again, or Cancel) — target line reverts to showing Set 1's target.
- [ ] Exercise with a uniform target (no per-set variation) — target line always shows that one target regardless of which set's panel is open, no visible change from before.
- [ ] Duration-only and has_reps/has_weight-gating behavior from Task 20 (stale crossed-out fields, no-target-data case) still holds, just evaluated per the currently-relevant set instead of the main row.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: tapped through Set 1 → Set 2 → Set 3 on a varying exercise in a real workout session and confirmed the target line changes each time, not just read from code.
