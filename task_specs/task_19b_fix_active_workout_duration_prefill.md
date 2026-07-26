# Task 19b — Fix: ActiveWorkout ignores per-set duration overrides

## Objective
During an active workout, opening a set's logging panel should prefill Duration from that set's own per-set override first (falling back to the uniform target, then previous performance) — exactly like Weight and Reps already do. Right now Duration skips the per-set-override check entirely.

## Root cause (confirmed live — no further investigation needed)
`frontend/src/features/sessions/ActiveWorkout.tsx`, inside `openSetPanel` (~line 258-297):
```tsx
const perSetOverride = workoutExercise?.set_targets?.find((st) => st.set_number === setNumber);

// Weight: per-set override > uniform target > previous performance
if (perSetOverride?.target_weight) {
  setPanelWeight(perSetOverride.target_weight.toString());
} else if (workoutExercise?.target_weight) { ... }

// Reps: per-set override > uniform target > previous performance
if (perSetOverride?.target_reps) { ... }

// Duration: uniform target > previous performance   <-- no perSetOverride check at all
if (workoutExercise?.target_duration_seconds) {
  setPanelDuration(workoutExercise.target_duration_seconds);
} else {
  const prevSet = getPreviousSetData(workoutExerciseId, setNumber);
  setPanelDuration(prevSet?.duration_seconds ?? null);
}
```
Verified live: an exercise with Set 1 saved at 1h20m45s and Set 2 saved at 30m — opening Set 2's panel during a workout showed 1h20m45s (Set 1's/the uniform value), not Set 2's own 30m.

## Requirements
1. Add the same `perSetOverride?.target_duration_seconds` check, in the same priority order already used for Weight/Reps:
   ```tsx
   // Duration: per-set override > uniform target > previous performance
   if (perSetOverride?.target_duration_seconds) {
     setPanelDuration(perSetOverride.target_duration_seconds);
   } else if (workoutExercise?.target_duration_seconds) {
     setPanelDuration(workoutExercise.target_duration_seconds);
   } else {
     const prevSet = getPreviousSetData(workoutExerciseId, setNumber);
     setPanelDuration(prevSet?.duration_seconds ?? null);
   }
   ```
2. Nothing else in `openSetPanel` needs to change — `perSetOverride` is already computed once and reused for weight/reps; just add the duration branch to use it too.

## Do NOT
- Do not change the Weight/Reps logic — already correct, don't touch it.
- Do not change anything in Plan Builder — this is purely an `ActiveWorkout.tsx` fix.

## Acceptance criteria
- [ ] Exercise with per-set duration overrides (e.g. Set 1 = 1h20m45s, Set 2 = 30m, saved via "Vary by set"). Start a workout, open Set 1's panel — shows 1h20m45s. Open Set 2's panel — shows 30m, not Set 1's value.
- [ ] An exercise with no per-set duration overrides still falls back to the uniform target duration, exactly as before.

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: reproduced the exact scenario above (two sets with different saved durations) in a real workout session, confirmed via the UI or DOM query — not just read from code.
