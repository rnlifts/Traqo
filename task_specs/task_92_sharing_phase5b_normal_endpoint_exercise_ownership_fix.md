# Task 92 — Fix "You do not own this exercise" for share recipients on the normal Active Workout screen

## READ THIS FIRST — strict execution rules (non-negotiable)

1. **This is a narrow bugfix, not a rewrite.** Touch only the files in the allowlist
   below. If you believe another file must change, STOP and ask first.
2. **A test that does not execute the code it claims to test is a task failure.** No
   placeholder assertions. Every test must call the real endpoint (TestClient) and assert
   on actual behavior.
3. **Run, do not claim.** Run the FULL backend suite (`python -m pytest -q` from
   `backend/`) **twice**, paste both real outputs. Baseline before your change: **254
   passed, 4 failed (pre-existing, unrelated — listed below), 2 skipped.** After your fix:
   same 4 pre-existing failures, plus your new tests passing, no new failures.
4. **Known pre-existing failures — do not touch.** `test_start_workout_without_auth_fails`,
   `test_quick_start_without_auth_fails`, `test_bootstrap_without_auth_fails`,
   `test_create_share_unauthenticated` all assert 401 but get 403 (a pre-existing FastAPI
   `HTTPBearer` behavior mismatch, confirmed present before Task 86 even started). Out of
   scope. Do not touch these tests or `oauth2.py`.
5. **No database migration.** No schema change needed — `workout_sessions.share_id`
   already exists (added in Task 86 step 1).
6. **No `git push`, no deploy.** Local commit only.
7. **Do not weaken exercise-ownership enforcement for genuinely normal (non-share)
   sessions.** A user must still be unable to log a set against an exercise they don't own
   via `POST /api/workout-sessions/{session_id}/sets` for any session where
   `share_id IS NULL`. This fix only changes behavior for sessions that were started
   through a share.

## File allowlist (do not touch anything else)

- `backend/src/modules/sessions/application/use_cases/add_workout_set.py` (modify)
- `backend/tests/integration/test_sharing_logging_phase4.py` (add new tests — reuse
  existing fixtures already in this file)

Do NOT touch `sessions/presentation/routes.py` (neither the normal `POST
/{session_id}/sets` handler nor the share-scoped one in `sharing/presentation/routes.py`)
— the preferred fix (below) requires no route-level changes at all.

## The bug

Found via a live browser walkthrough, immediately after verifying Task 91's fix
end-to-end (dev-log.md, 2026-08-05 "Task 91" entry has full detail). Scenario: a
recipient starts a workout via a share (works correctly — Task 87), gets navigated to the
app's normal Active Workout screen (works correctly — Task 91 just fixed the bootstrap
load). Clicking "Log set" on a real exercise then fails with:

```
{"error": "You do not own this exercise"}
```

**Root cause:** the normal Active Workout screen logs sets through
`POST /api/workout-sessions/{session_id}/sets` (NOT the share-token-scoped
`POST /api/shared/{token}/sessions/{id}/sets` endpoint — that one already works, Task 87
fixed it). The normal route's use case, `AddWorkoutSet.execute()`
(`add_workout_set.py`, current lines 106–115), only skips the exercise-ownership check
when the caller explicitly passes `skip_exercise_ownership_check=True` — and the normal
route (`sessions/presentation/routes.py`'s `add_workout_set` handler) never passes that
flag; it's hardcoded to the default `False`. So for a recipient (who legitimately owns the
session, per Task 87's attribution) trying to log against an exercise owned by the plan's
actual owner (the trainer), the check `exercise.user_id != user_id` still fails.

This gap exists because when Task 87 added `skip_exercise_ownership_check`, only the
share-token-scoped route was taught to pass it — at the time, no frontend flow routed an
authenticated recipient into the *normal* endpoint. Phase 5b's frontend (already built,
committed) does exactly that by design (recipients are meant to reuse the normal Active
Workout screen), so this previously-unreachable gap is now a live, blocking bug.

## The fix

Make the bypass **automatic** based on `session.share_id`, instead of requiring every
caller to explicitly opt in. `AddWorkoutSet.execute()` already loads `session` as its very
first step (line 86: `session = self.session_repository.get_by_id(session_id)`) — reuse
that, no extra query needed.

In `add_workout_set.py`, change the condition around line 108 from:
```python
if not skip_exercise_ownership_check:
    if not exercise or exercise.user_id != user_id:
        raise UnauthorizedExerciseAccessError(
            f"User {user_id} does not own exercise {workout_exercise.exercise_id}"
        )
else:
    if not exercise:
        raise ValueError(f"Exercise {workout_exercise.exercise_id} not found")
```
to something equivalent to:
```python
bypass_ownership_check = skip_exercise_ownership_check or session.share_id is not None
if not bypass_ownership_check:
    if not exercise or exercise.user_id != user_id:
        raise UnauthorizedExerciseAccessError(
            f"User {user_id} does not own exercise {workout_exercise.exercise_id}"
        )
else:
    if not exercise:
        raise ValueError(f"Exercise {workout_exercise.exercise_id} not found")
```
(Exact variable naming is your call — keep it readable. Update the docstring's `Checks are
performed in order` list and the `skip_exercise_ownership_check` arg description to
mention that a share-originated session (`session.share_id is not None`) bypasses this
check automatically, in addition to the explicit flag.)

This means:
- The normal endpoint now correctly allows logging for any session where
  `share_id IS NOT NULL` (i.e. started via a share), regardless of who the caller is —
  which is safe, because `session.user_id == user_id` was already required by the
  session-ownership check earlier in this same function (step 1) before this code is even
  reached; you can only be here if you already own this specific session.
- The normal endpoint's behavior for genuinely normal sessions (`share_id IS NULL`) is
  completely unchanged — still strict.
- The share-token-scoped route's existing explicit `skip_exercise_ownership_check=True`
  becomes redundant (its sessions always have `share_id` set anyway) but is harmless —
  leave that route alone, don't remove the flag from it.

## Required tests (add to `test_sharing_logging_phase4.py`)

1. **The exact regression scenario**: an authenticated recipient starts a session via
   share (reuse existing fixtures: `owner_plan_with_exercise`,
   `share_log_permission_anyone`, `recipient_auth_headers`), then logs a set through the
   **normal** endpoint, `POST /api/workout-sessions/{session_id}/sets` (NOT the
   `/api/shared/...` one — that path already has coverage from Task 87). Assert `201`, not
   403, and assert the returned set's `exercise_id` matches the exercise used.
2. **Confirm normal, non-share sessions are still strictly protected**: search this file
   and `test_sessions_routes.py` for an existing test asserting that a normal
   (non-share) session rejects logging against an exercise the caller doesn't own via this
   same normal endpoint. If one already exists (it likely does, given `add_workout_set.py`
   already had this exact check before Task 87), just confirm in your report that it still
   passes unmodified. If none exists, add one as a negative control.
3. **Multiple sets in a row via the normal endpoint for a share session** work correctly
   (set_number increments) — mirrors the existing
   `test_add_multiple_sets_increments_set_number` pattern from the share-scoped tests, but
   through the normal endpoint this time.

## Acceptance criteria

- Full backend suite run twice: 254+ baseline passed / 4 pre-existing failures / 2 skipped,
  plus your new tests passing, no new failures anywhere. Paste both full run outputs.
- The exact live scenario (authenticated recipient logging a set via the normal Active
  Workout screen's endpoint, after starting via share) must work — prove it with the new
  test, not just a claim.
- Normal (non-share) exercise-ownership enforcement is provably unchanged.
- No migration, no push, no files outside the allowlist touched without stopping to ask.
