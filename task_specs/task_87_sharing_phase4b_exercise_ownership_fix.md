# Task 87 — Fix exercise-ownership check blocking authenticated recipients from logging via share (Task 86 Phase 4b)

## READ THIS FIRST — strict execution rules (non-negotiable)

1. **This is a narrow bugfix, not a rewrite.** Touch only the files listed in the file
   allowlist below. If you believe another file must change, STOP and ask before touching
   it — do not silently expand scope, even if it seems obviously necessary.
2. **A test that does not execute the code it claims to test is a task failure.** No
   `expect(true).toBe(true)`, no "verified by code review" comments, no asserting only
   that a mock "is defined". Every test must call a real endpoint (TestClient) and assert
   on actual behavior/status codes/DB state.
3. **Run, do not claim.** Before reporting done: run the FULL backend suite
   (`python -m pytest -q` from `backend/`) **twice**. Paste the actual final counts from
   both runs in your report. If the two runs disagree, investigate before reporting either
   number.
4. **Known pre-existing failures — do not touch, do not "fix".** The full suite currently
   has 4 pre-existing failures unrelated to sharing: `test_start_workout_without_auth_fails`,
   `test_quick_start_without_auth_fails`, `test_bootstrap_without_auth_fails`,
   `test_create_share_unauthenticated` (all assert 401, actual is 403 — a pre-existing
   FastAPI `HTTPBearer` behavior mismatch, confirmed present before this task and before
   Task 86 Phase 4). Expect **246 passed, 4 failed, 2 skipped** as your baseline before your
   changes. Do not modify `oauth2.py` or these 4 test files to "fix" this — it is explicitly
   out of scope for this task.
5. **Do NOT create any database migration.** No schema change is needed for this fix.
6. **Do NOT `git push`, do not deploy.** Local commit only.
7. **Do not weaken the check for the normal (non-share) endpoint.** The existing behavior —
   a user cannot log a set against an exercise they don't own, via the normal
   `POST /api/workout-sessions/{id}/sets` endpoint — MUST remain exactly as strict as it is
   today. Your fix must be additive/opt-in, not a removal of the check.

## File allowlist (do not touch anything else)

- `backend/src/modules/sessions/application/use_cases/add_workout_set.py` (modify)
- `backend/src/modules/sharing/presentation/routes.py` (modify — only the
  `add_set_via_share` handler)
- `backend/tests/integration/test_sharing_logging_phase4.py` (add new tests to the
  existing `TestAddSetViaShare` class — do not rewrite existing tests)

If you believe any other file needs a change to make this work, STOP and report why
instead of touching it.

## The bug

Reproduced live end-to-end against a real running backend (dev-log.md, 2026-08-05 entry
has full detail). Scenario: a plan owner creates a custom exercise (e.g. "Deadlift") and a
plan using it, shares the plan in `anyone`/`log` mode, and a **different, authenticated
user** (the recipient/client) uses the share to start a workout and log a set.

- `POST /api/shared/{token}/start` succeeds — the session is correctly created with
  `user_id=recipient, share_id=<share>, logged_by_user_id=recipient` (this part is correct
  and already covered by existing tests).
- `POST /api/shared/{token}/sessions/{session_id}/sets` **fails** with
  `{"error": "You do not own this exercise"}` — the set is never recorded.

Root cause: `AddWorkoutSet.execute()` in `add_workout_set.py` (currently around lines
101–106) hard-requires:

```python
exercise = self.exercise_repository.get_by_id(workout_exercise.exercise_id)
if not exercise or exercise.user_id != user_id:
    raise UnauthorizedExerciseAccessError(...)
```

The share route (`add_set_via_share` in `routes.py`, currently calling `use_case.execute(
user_id=session.user_id, ...)`) passes the **session owner** as `user_id`. For an
anonymous logger, `session.user_id` is the plan owner — who also owns the exercise — so
this check passes *by coincidence*. For an authenticated recipient, `session.user_id` is
the recipient, but the exercise still belongs to the plan owner, so the check always fails.
This breaks the primary sharing use case (a trainer's client logging sets against the
trainer's own exercises). It was not caught in Phase 4 because the existing tests
(`test_anonymous_adds_set_via_share`, `test_add_multiple_sets_increments_set_number`) only
exercise the anonymous path, which happens to pass by coincidence.

## The fix

By the time `add_set_via_share` calls `AddWorkoutSet.execute()`, the route has already
resolved the caller's effective permission via `ResolveShareAccess` and confirmed it is
`>= 'log'` on this specific plan's share, and confirmed the target session belongs to that
same share (`session.share_id == share.id`). That means exercise ownership has effectively
already been authorized at the share level — re-checking raw `exercise.user_id == user_id`
inside `AddWorkoutSet` is both redundant and wrong for this path.

Add an opt-in bypass parameter, following the exact pattern already used for
`skip_ownership_check` in `start_workout.py` (Task 86 Phase 4) — do not invent a different
pattern:

1. In `add_workout_set.py`, add a new `execute()` parameter
   `skip_exercise_ownership_check: bool = False`. Wrap the existing ownership check (only
   that check — not the session-ownership check, not the finished-session check) so it is
   skipped when this flag is `True`:

   ```python
   if not skip_exercise_ownership_check:
       exercise = self.exercise_repository.get_by_id(workout_exercise.exercise_id)
       if not exercise or exercise.user_id != user_id:
           raise UnauthorizedExerciseAccessError(...)
   else:
       exercise = self.exercise_repository.get_by_id(workout_exercise.exercise_id)
       if not exercise:
           raise ValueError(f"Exercise {workout_exercise.exercise_id} not found")
   ```

   (Adjust exact control flow as needed, but: default `False` preserves today's behavior
   exactly for every existing caller; `exercise` must still be loaded either way since it's
   used later for `workout_set.exercise_id`. Update the docstring's `Args`/`Raises` section
   to document the new parameter.)

2. In `routes.py`, in `add_set_via_share`, pass `skip_exercise_ownership_check=True` when
   constructing/calling `AddWorkoutSet` — since permission was already verified via the
   share resolution above it in the same handler.

3. **Do not touch** any other caller of `AddWorkoutSet` (e.g. the normal
   `/api/workout-sessions/{id}/sets` route) — it must keep calling `execute()` without this
   flag, so it defaults to `False` and behaves exactly as before.

## Required tests (add to `TestAddSetViaShare` in `test_sharing_logging_phase4.py`)

1. **The exact regression scenario**: an authenticated recipient (not the plan owner, not
   anonymous) with a `log`-permission grant starts a session via share and successfully
   adds a set against the plan owner's exercise. Assert `201` and correct `set_number`.
   This is the test that was missing and must fail against the current code before your
   fix (verify this yourself locally before submitting — do not just trust that it would
   fail).
2. A **negative-control style assertion** within that same test or a sibling test:
   directly query the created set's `exercise_id` and confirm it matches the exercise
   used, and confirm the session's `user_id` is still the recipient (i.e., the fix didn't
   accidentally reassign session ownership to fix the symptom).
3. Confirm the existing normal (non-share) `AddWorkoutSet` behavior is untouched: if there
   is not already a test in the existing suite asserting that a user cannot log a set
   against an exercise they don't own via the *normal* `/api/workout-sessions/{id}/sets`
   endpoint, add one. If one already exists (search `tests/integration/` for
   `UnauthorizedExerciseAccessError` or "does not own exercise" before assuming it's
   missing), just confirm in your report that it still passes unmodified — do not
   duplicate it.

## Acceptance criteria

- Full backend suite run twice: baseline 246 passed / 4 failed (pre-existing, listed above)
  / 2 skipped, **plus** your new test(s) passing, **plus** all existing Phase 4 tests still
  passing. No new failures anywhere. Paste both full run outputs.
- The exact live scenario described above (authenticated recipient logs a set against the
  owner's exercise via share) must work — prove it with the new test, not just a claim.
- Normal, non-share exercise-ownership enforcement is provably unchanged (existing test
  still passes, or new one added per item 3 above).
- No migration, no push, no files outside the allowlist touched without stopping to ask
  first.
