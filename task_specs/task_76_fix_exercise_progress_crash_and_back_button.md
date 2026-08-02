# Task 76 — Fix exercise progress crash on partial sets, and the broken "Back to Exercises" button

## Objective
Two independent, confirmed bugs in the exercise progress page (`/exercises/:exerciseId/progress`), found live while checking Task 74's history-preservation fix. Both are pre-existing, unrelated to Task 74 itself.

## Bug A — progress page crashes for any exercise with a weight-only or reps-only logged set

### Confirmed root cause (reproduced with a real traceback, not just read from code)
`backend/src/modules/sessions/application/use_cases/get_exercise_progress.py:120`:
```python
volume = sum(s.weight * s.reps for s in session_sets)
```
If any set has `reps = None` (or `weight = None`), this raises `TypeError: unsupported operand type(s) for *: 'float' and 'NoneType'` and the entire progress page fails to load — not just for that one set, for the whole exercise. Confirmed via direct reproduction: `GET /api/exercises/{id}/progress` for an exercise with one such set returns a raw 500.

This is expected to happen in completely normal use, not an edge case: exercises are configurable per `has_reps`/`has_weight`/`has_duration` (`workout_exercises` table), so a reps-only, weight-only, or duration-only exercise's logged sets will have `NULL` in whichever field isn't tracked. Any user who has ever logged a set for such an exercise hits this crash the moment they open its progress page.

Three more spots in the same file have the identical assumption and need the same treatment:
- Line 124: `e1rm = round(s.weight * (1 + s.reps / 30), 1)` — same crash, requires both fields.
- Line 128 (`is_weight_pr = ... and s.weight > running_max_weight`) — fine on its own, but `running_max_weight = max(running_max_weight or 0, s.weight)` (line 146) will crash if `s.weight` is `None`.
- Line 129 / line 147 — identical pattern for `s.reps` / `running_max_reps`.
- `_build_personal_records` (line 194 onward) — `if heaviest_weight is None or s.weight > heaviest_weight` and `if most_reps is None or s.reps > most_reps` both crash if `s.weight`/`s.reps` is `None` (comparing `None > number` raises `TypeError` in Python, unlike JavaScript).

### Required behavior (not just "don't crash" — preserve what data exists)
- **Volume and estimated 1RM** genuinely require both weight and reps — a set missing either simply doesn't contribute a volume/e1rm value. Don't skip the *set* from the response entirely (that would hide real logged data, working against Task 74's whole point) — just make `estimated_1rm` on that set `None`/absent, and exclude sets lacking either field from the volume sum and from 1RM-based PR comparisons.
- **Heaviest-weight PR** should still track from `s.weight` alone, independent of whether `s.reps` is present on that set — same for **most-reps PR** tracking from `s.reps` alone. Guard each comparison on its own field being non-`None`, don't let one missing field block tracking of the other.
- **Session volume** for a session where every set is missing weight or reps: volume is `0` (or the sum of whatever qualifying sets exist) — not a crash, not a missing field.

### Backend changes required
- `get_exercise_progress.py`: guard all four spots above (lines 120, 124, 128/146, 129/147, and `_build_personal_records`).
- `ProgressSet` dataclass and `ProgressSetResponse` schema (`backend/src/modules/sessions/presentation/schemas.py`): change `estimated_1rm: float` → `estimated_1rm: float | None`.
- Trace through and confirm nothing else assumes `estimated_1rm` is always present (e.g. `is_e1rm_pr` should simply be `False` when `estimated_1rm` is `None` for that set — a set with no e1rm can't be a new e1rm PR).

### Frontend changes required
`frontend/src/features/progress/ExerciseProgress.tsx` currently assumes every set has numeric `weight`, `reps`, and `estimated_1rm` in several places — all need to handle `null`/absent gracefully instead of rendering broken output or picking a wrong "best" value:
- Line 388: `Set {set.set_number}: {set.weight} × {set.reps}` — when one is missing, show just the field that exists (e.g. "Set 1: 5 reps" or "Set 1: 100 lbs"), not a dangling "×" with nothing after it.
- Line 403: `Est. 1RM: {set.estimated_1rm} lbs` — don't render this line at all when `estimated_1rm` is `null` for that set.
- Line 433: `Math.max(...session.sets.map((s) => s.estimated_1rm))` — filter out `null` values before taking the max; if a session has zero sets with a computable e1rm, don't render the "Best Set Est. 1RM" line for that session at all rather than showing `NaN`/`Infinity` weirdness.
- `buildChartData()`'s `est_1rm` and `best_weight` cases (lines 41-53, 61-73) both do a `.reduce()` comparing `current.estimated_1rm`/`current.weight` — filter to only sets where that specific field is non-null before reducing, so a session with a mix of complete and partial sets doesn't silently pick a wrong "best" set for the chart.

### Do NOT
- Do not touch `SessionDetail.tsx`'s own set rendering (`Set {set.set_number}: {set.weight} × {set.reps}` at line 145) unless you find it's also crashing — it isn't (confirmed: React renders `null`/`undefined` as nothing in JSX, so it degrades to a slightly ugly "100 × " rather than crashing). If you want to also clean that up for consistency while you're in this area, that's a nice-to-have, not required — don't let it expand scope.
- Do not add duration-based PR tracking (heaviest weight/most reps/best e1rm/best volume don't cover duration-only exercises today, and that's an existing, separate scope gap — not something this bug-fix task should try to solve).

## Bug B — "Back to Exercises" navigates to a page that doesn't exist

### Confirmed root cause
`frontend/src/pages/ExerciseProgressPage.tsx:39` — `navigate("/exercises")`. Checked `App.tsx`'s route list: there is no `/exercises` route anywhere in this app, only `/exercises/:exerciseId/progress`. There is also no "exercise list" page of any kind to go "back" to — checked, `SessionDetail.tsx` is the *only* place in the app that links into the progress page. So this button's destination was never a real page.

### Required change
Change the button to `navigate(-1)` (go back to wherever the user actually came from — the session detail page) instead of a hardcoded, nonexistent route.

### Do NOT
- Do not build a new `/exercises` list page — that's out of scope for a navigation bug fix, and nothing in the app currently needs one.

## Acceptance criteria
- [ ] Open the progress page for an exercise that has at least one logged set missing weight or reps (e.g. a reps-only or weight-only exercise) — page loads successfully, no 500, no crash.
- [ ] That set's row shows only the field(s) it actually has; no "Est. 1RM" line for sets where it can't be computed.
- [ ] Heaviest-weight and most-reps PRs still correctly track for exercises where only one of those fields is ever logged.
- [ ] Existing exercises with complete weight+reps data on every set show no change in behavior (volume, 1RM, PRs, charts all identical to before this fix).
- [ ] Clicking "Back to Exercises" from the progress page returns to the session detail page you came from, not a blank page.
- [ ] Full frontend test suite passes; `npx tsc -b` clean. Backend test suite passes.

## Review checklist
- [ ] Live-verify Bug A specifically with a real exercise that has a `NULL` weight or reps set in the dev database — don't just trust unit tests with clean synthetic data, this bug only shows up with genuinely partial data.
- [ ] Confirm the chart (all three metrics: Est. 1RM, Volume, Best Weight) still renders correctly and doesn't silently mis-select a "best" set when a session has a mix of complete and partial sets.
- [ ] Confirm normal fully-populated exercises are pixel-identical to before — this task must not change behavior for the common case, only stop it from crashing on the partial-data case.
