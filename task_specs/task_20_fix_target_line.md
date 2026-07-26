# Task 20 — Fix the exercise card's "Target:" summary line

## Objective
`ActiveWorkout.tsx`'s "Target: ..." line under each exercise name is currently misleading in two ways: (1) it ignores `has_reps`/`has_weight`/`has_duration`, so a crossed-out or stale field can show up in the summary even though that field isn't actually part of the exercise, and (2) it never mentions Duration at all, and it always shows one blanket number even when per-set overrides make sets differ — which is what looked like "only shows the first targeted set" in the original bug report.

## Context
- File: `frontend/src/features/sessions/ActiveWorkout.tsx`, `buildTargetLine()` (~line 175-182):
  ```tsx
  const buildTargetLine = (we: WorkoutExercise): string | null => {
    const parts: string[] = [];
    if (we.target_sets !== null) parts.push(`${we.target_sets} sets`);
    if (we.target_reps !== null) parts.push(`${we.target_reps} reps`);
    if (we.target_weight !== null) parts.push(`${we.target_weight} lbs`);
    if (parts.length === 0) return null;
    return "Target: " + parts.join(" × ");
  };
  ```
  Called once per exercise card (~line 771: `const targetLine = buildTargetLine(we);`) and rendered as a line of text under the exercise name.
- Problems, confirmed by reading the code (root cause, not speculation):
  1. No check against `we.has_reps`/`we.has_weight`/`we.has_duration` — if `target_reps` happens to be non-null (e.g. a stale value left over from before a field was crossed out, or written by the Task 14 Set-1 sync even though `has_reps` is false), it still gets shown.
  2. No Duration at all — `target_duration_seconds` is never included, so duration-only exercises show a completely empty/unhelpful target line (or worse, a stale reps/weight fragment per bug #1).
  3. Always shows one number per field, sourced from the *main row* (effectively Set 1's value) — when per-set overrides make sets 2+ different, the line still confidently states one blanket target as if it applied to every set, which is what read as "only shows the first targeted set."
- `WorkoutExercise` interface in this file already has `set_targets: { set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds?: number | null }[]` (the shape used by `openSetPanel`'s `perSetOverride` lookup — reuse the same field name).
- For formatting duration, use `secondsToHMS` from `frontend/src/utils/duration.ts` (already used by `DurationInput.tsx` for the same conversion) — format as e.g. `1h 20m` or `45s`, whichever components are non-zero (don't print "0h 0m" padding).

## Requirements
1. **Gate by has_* flags**: only include `target_reps` in the line if `we.has_reps` is true, only `target_weight` if `we.has_weight`, and add `target_duration_seconds` (formatted via `secondsToHMS`) if `we.has_duration` is true. `target_sets` has no corresponding has_* flag — always include it as today.
2. **Detect per-set variation**: check whether `we.set_targets` (if present and non-empty) has any set whose *has_* -relevant values differ from the main row's values (e.g. any set's `target_reps` differs from `we.target_reps` when `has_reps`, similarly for weight/duration). If sets vary:
   - Replace the per-field number for that varying field with an indicator that it varies — simplest: append " (varies by set)" to the whole line if any field varies, rather than per-field precision (keep this simple, don't over-engineer per-field granularity).
   - If sets do NOT vary (uniform target, or no per-set overrides saved), show the line exactly as today (just with the has_* gating and duration added).
3. Keep the return type `string | null` — return `null` (hiding the line) only if there's truly nothing to show (no sets, no reps, no weight, no duration — matches today's `parts.length === 0` behavior).

## Do NOT
- Do not change what data is stored or sent to the backend — this is a display-only fix in `ActiveWorkout.tsx`.
- Do not add a similar summary line to Plan Builder — it doesn't have one today (trainers see live editable fields there, not a summary), and this task doesn't add one.
- Do not try to show each set's individual target inline in this summary line — "varies by set" is sufficient; the actual per-set numbers are already correctly visible when a trainer/client taps into each set's own panel (confirmed working in Tasks 14/19).

## Acceptance criteria
- [ ] Exercise with `has_reps: false` but a stale non-null `target_reps` value in the database (reproduce by crossing out Reps in Plan Builder without clearing the underlying value, or via direct API) — the "Target:" line does NOT show a reps fragment.
- [ ] Duration-only exercise (has_duration true, has_reps/has_weight false) with `target_duration_seconds` set — the "Target:" line shows the duration (e.g. "Target: 2 sets × 1h 20m"), not blank and not a reps/weight fragment.
- [ ] Exercise with uniform per-set values (no variation, or vary-by-set never used) — line shows exactly as before, one number per field, no "(varies by set)" suffix.
- [ ] Exercise with genuinely different per-set overrides (e.g. Set 1 reps "8", Set 2 reps "12") — line includes a "(varies by set)" indicator instead of confidently stating one number.
- [ ] Exercise with no target data at all — line doesn't render (component returns `null`, same as today).

## Review checklist
- [ ] TypeScript compiles with no new errors.
- [ ] Verified live: all five scenarios above reproduced in a real workout session, not just read from code.
