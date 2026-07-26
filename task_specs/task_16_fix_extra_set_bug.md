# Task 16 — Fix: can't add a 4th/5th set in quick-start workouts

**Send this after Task 15 — this task assumes the extra-set pip is now gated to quick-start only.**

## Objective
Fix the bug where a quick-start workout can only ever get exactly one extra set beyond the planned count — trying to add a second extra set (e.g. a 5th set when 3 are planned and a 4th is already logged) doesn't work.

## Root cause (already identified — implement the fix, no further investigation needed)
In `frontend/src/features/sessions/ActiveWorkout.tsx`, the extra-set pip's click handler hardcodes its target set number to `pipCount + 1`:
```tsx
<button
  onClick={() => openSetPanel(we.id, pipCount + 1)}
  aria-label={`Add extra set`}
  ...
>
  +
</button>
```
`pipCount` (from `getPipCount(we)`) is the *planned* set count and never changes as extra sets get logged. So if `pipCount` is 3:
- First click on "+" opens the panel for set 4 — logging it works.
- Second click on "+" *still* calls `openSetPanel(we.id, 4)` — since set 4 is already logged, `openSetPanel` finds `existingSet` and re-opens set 4's panel for editing, instead of advancing to set 5. There is no way to reach set 5 (or any set beyond 4).

## Requirements
1. Compute the actual next available set number dynamically instead of the hardcoded `pipCount + 1`. It should be `Math.max(pipCount, exerciseSets.length) + 1`, where `exerciseSets` is the exercise's already-logged sets (available in that render scope via `getExerciseSets(we.id)`, already computed once per exercise card as the local `exerciseSets` variable — reuse it, don't recompute).
2. Render **one pip per already-logged extra set** (beyond `pipCount`), in addition to the trailing dashed "+" pip:
   - For each logged set number greater than `pipCount`, render a numbered/checkmark pip identical in style to the regular target pips (tappable to edit/delete, same as any other logged pip) — reuse the same rendering logic/style as the target-pips `.map()` above it rather than duplicating markup; the cleanest approach is to extend the array being mapped over from `Array.from({ length: pipCount })` to `Array.from({ length: Math.max(pipCount, exerciseSets.length) })`, so already-logged extra sets naturally appear as filled pips using the existing per-pip rendering code, and only the *trailing* dashed "+" pip is a separate element after that map.
   - The dashed "+" pip after them opens `Math.max(pipCount, exerciseSets.length) + 1`.
3. This only applies within the `isQuickStart` gating from Task 15 — the dashed "+" pip (and by extension this whole fix) is only reachable on quick-start sessions.

## Do NOT
- Do not change `getPipCount` — it should keep returning the planned count only; extra sets are handled additively in the render, not by changing what "planned" means.
- Do not change backend behavior — `set_number` values beyond the plan already save fine (permissive validation confirmed in a prior task).
- Do not artificially cap how many extra sets can be added — a client should be able to keep clicking "+" indefinitely (5th, 6th, etc.) for quick-start sessions.

## Acceptance criteria
- [ ] Start a quick-start workout with an exercise planned for 3 sets. Log sets 1, 2, 3 normally.
- [ ] Click the dashed "+" pip — it opens a panel for set 4. Log it. A new filled pip labeled "4" (or ✓) now appears where the dashed "+" was, and a new dashed "+" pip appears after it.
- [ ] Click the dashed "+" pip again — it opens a panel for set 5 (not set 4 again). Log it. Same pattern repeats: set 5 becomes a filled pip, dashed "+" moves to the end.
- [ ] Tapping the set-4 or set-5 pip after logging opens that specific set's panel for editing/deleting, not a fresh empty panel.
- [ ] Deleting set 5 (via the panel's "Delete set" button) removes its pip and the dashed "+" pip's next target recalculates correctly (back to targeting set 5 again, not 6).
- [ ] Real (non-quick-start) plans are unaffected — no dashed "+" pip present at all (per Task 15).

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: actually clicked through logging a 4th and 5th set in a real browser session, confirmed via the UI (or DOM query) that both sets were saved with correct `set_number` values — this is the exact bug the owner reported, so a code-level review without live reproduction is not sufficient.
