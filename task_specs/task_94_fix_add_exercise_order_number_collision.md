# Task 94 — Backend: fix 500 when adding an exercise after deleting a non-last one

## Objective
Fix a reproducible 500 Internal Server Error: in an existing (saved) plan day, deleting
any exercise that is **not the last one** in the day, then adding any new exercise to
that same day, throws an unhandled `sqlalchemy.exc.IntegrityError` (Postgres unique
violation) instead of succeeding.

## Context — confirmed root cause (reproduced locally and on production)

`AddExerciseToDay.execute()` computes the new row's `order_number` from a **count**,
not from the highest existing value:

```python
# backend/src/modules/workouts/application/use_cases/add_exercise_to_day.py:110-111
existing_exercises = self.exercise_repository_workout.list_by_day(day_id)
next_order = len(existing_exercises) + 1
```

`RemoveExerciseFromDay.execute()` deletes the row but never renumbers the exercises
left behind (`backend/src/modules/workouts/application/use_cases/remove_exercise_from_day.py:81`).

So: a day with exercises at `order_number` 1, 2, 3, 4 — delete the one at 2 — leaves
`1, 3, 4` (3 rows). The next add computes `next_order = 3 + 1 = 4`, which collides with
the `4` still in the table. The insert violates the DB's
`workout_exercises_plan_day_id_order_number_key` unique constraint
(`UNIQUE(plan_day_id, order_number)`), raising `IntegrityError`. Nothing catches it, so
it falls through to `app.py`'s catch-all `general_exception_handler` → 500, with only
`{"error": "Internal server error"}` reaching the browser (the real traceback is
server-side only, in the log).

Confirmed live on production (`http://176.103.218.87`, since the team migrated off
Railway to a VPS): reproduced the identical `POST /api/workout-plans/{id}/days/{id}/exercises`
→ `500`, matching the report exactly (edit a plan → delete an exercise → add one → 500).

## Requirements

1. **Fix `AddExerciseToDay`**: compute `next_order` from the **maximum existing
   `order_number`** in the day (default 0 if the day is empty), not from a count, e.g.
   `next_order = max((we.order_number for we in existing_exercises), default=0) + 1`.
   This is the minimal, safe fix — no renumbering of existing rows required, order
   numbers just stop being assumed-contiguous.
2. **Audit every other place that assumes contiguous `order_number`s** for the same
   bug class, in particular `ReorderDayExercise` (`reorder_day_exercise.py`) — confirm
   whether its swap logic tolerates gaps, and fix if not. Report what you found even if
   no change was needed there.
3. **Belt-and-suspenders: catch the DB-level race too.** Two concurrent adds to the
   same day could still collide on `next_order` even after the fix above (TOCTOU
   between the `list_by_day` read and the `add` insert). Catch `IntegrityError` in
   `WorkoutExerciseRepositoryImpl.add()` (or in the use case) and translate it to a
   clear, already-handled domain exception rather than letting a raw `IntegrityError`
   reach `app.py`'s catch-all — the catch-all should be a last resort, not the normal
   path for a foreseeable constraint violation.

## Do NOT
- Do not attempt to migrate/renumber existing production data as part of this fix —
  the fix must work correctly regardless of existing gaps, so no backfill is needed.
- Do not change the unique constraint itself (`plan_day_id, order_number`) — it's doing
  its job here (catching a real bug); the fix is on the application side.
- Do not touch `PlanBuilder.tsx` / `ActiveWorkout.tsx` frontend add-exercise flow —
  this is a pure backend ordering bug, no frontend change is implicated.

## Regression test required (per project testing policy)
Add a unit test for `AddExerciseToDay` (or an integration/route test) that:
1. Creates a day with 3+ exercises.
2. Deletes one that is *not* the last (e.g. the 2nd of 4).
3. Adds a new exercise to the same day.
4. Asserts this succeeds (no exception) and the new row gets a `order_number` that
   doesn't collide with any surviving row.

This must be a **new** test — running the existing suite alone would not have caught
this (confirmed: the existing suite passes today, on the buggy code).

## Acceptance criteria
- [ ] Reproduce the bug first (delete a non-last exercise, then add) against a local
      dev DB with the *unfixed* code, confirming the same `IntegrityError` — don't fix
      blind.
- [ ] After the fix, the same steps succeed with a `201 Created`.
- [ ] New regression test added and passing.
- [ ] Full existing test suite still passes.
- [ ] `ReorderDayExercise` audited per Requirement 2; findings reported.

## Review checklist (PM verification before calling this done)
- [ ] Live-verify against the actual running app (not just tests): create a plan with
      3+ exercises, delete a non-last one, add a new one, confirm success — both
      locally and (after deploy) on production.
- [ ] Confirm the IntegrityError-to-domain-exception translation (Requirement 3) is
      actually reachable — force a concurrent-add race or at least confirm by code
      inspection that the catch is in the right place (wrapping the `session.commit()`
      that can raise it).
