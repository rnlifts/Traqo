# Task 91 — Fix "You do not own this plan" for share recipients on the Active Workout screen

## READ THIS FIRST — strict execution rules (non-negotiable)

1. **This is a narrow bugfix, not a rewrite.** Touch only the files in the allowlist
   below. If you believe another file must change, STOP and ask first.
2. **A test that does not execute the code it claims to test is a task failure.** No
   placeholder assertions. Every test must call the real endpoint (TestClient) and assert
   on actual behavior/status codes/response content.
3. **Run, do not claim.** Run the FULL backend suite (`python -m pytest -q` from
   `backend/`) **twice**, paste both real outputs. Baseline before your change: **252
   passed, 4 failed (pre-existing, unrelated — listed below), 2 skipped.** After your fix:
   same 4 pre-existing failures, plus your new tests passing, no new failures.
4. **Known pre-existing failures — do not touch.** `test_start_workout_without_auth_fails`,
   `test_quick_start_without_auth_fails`, `test_bootstrap_without_auth_fails`,
   `test_create_share_unauthenticated` all assert 401 but get 403 (a pre-existing FastAPI
   `HTTPBearer` behavior mismatch, confirmed present before Task 86 even started). Out of
   scope. Do not touch these tests or `oauth2.py`.
5. **No database migration.** No schema change needed.
6. **No `git push`, no deploy.** Local commit only.
7. **Do not weaken plan-ownership enforcement anywhere else.** The normal
   `GET /api/workout-plans/{plan_id}` endpoint (and any other endpoint that lets a plan's
   owner manage/view their own plan) MUST continue to reject non-owners exactly as it does
   today. This fix is narrowly scoped to one specific endpoint where the authorization
   boundary is actually session ownership, not plan ownership — do not generalize it.

## File allowlist (do not touch anything else)

- `backend/src/modules/sessions/presentation/routes.py` (modify — only the
  `get_active_workout_bootstrap` handler, i.e. the `GET /api/workout-sessions/{session_id}/bootstrap`
  route)
- `backend/tests/integration/test_sharing_logging_phase4.py` (add new tests — reuse the
  existing fixtures in this file, e.g. `owner_plan_with_exercise`,
  `share_log_permission_anyone`, `recipient_auth_headers`, `recipient_user`, which already
  exist here from Task 87)

If a fix requires touching `get_workout_plan_detail.py` or any other file, STOP and ask —
the preferred fix (below) does not require it.

## The bug

Reproduced live end-to-end against a real running backend and frontend (dev-log.md,
2026-08-05 "Task 90" entry has full detail). Scenario: a trainer shares a plan
`anyone`/`log`, a different, authenticated user (the recipient) starts a workout via
`POST /api/shared/{token}/start` — this correctly succeeds and the session is correctly
attributed to the recipient (`session.user_id = recipient`, verified in Task 87). The
frontend then navigates the recipient to the app's normal, already-existing Active
Workout screen at `/workout-sessions/{session_id}`, exactly as designed — recipients are
supposed to just use the standard authenticated flow from here, no share-specific
frontend needed.

That screen calls `GET /api/workout-sessions/{session_id}/bootstrap` to load everything it
needs in one call. That request returns **403 Forbidden**, `{"error": "You do not own this
plan"}` — even though the session legitimately belongs to the recipient.

**Root cause**, in `sessions/presentation/routes.py::get_active_workout_bootstrap`:

```python
if session.workout_plan_id:
    use_case_plan = GetWorkoutPlanDetail(plan_repo, workout_exercise_repo, day_repo, week_repo)
    plan, _ = use_case_plan.execute(session.workout_plan_id, user_id)
    plan_response = build_plan_detail_response(
        plan, session.workout_plan_id, use_case_plan, workout_exercise_repo, day_repo, week_repo, db
    )
```

`GetWorkoutPlanDetail.execute()` (`workouts/application/use_cases/get_workout_plan_detail.py`)
hard-requires `plan.user_id == requesting_user_id`, raising
`UnauthorizedWorkoutPlanAccessError` otherwise (mapped to 403 by a global handler in
`app.py`). The plan still belongs to the trainer, not the recipient, so this always fails
for a share recipient — regardless of whether their session is entirely legitimate.

Earlier in the SAME handler (not shown above, look above it in the file), the caller's
right to view this session at all is already established via
`GetWorkoutSessionDetail.execute(user_id, session_id)`, which raises
`UnauthorizedWorkoutSessionAccessError` if `session.user_id != user_id`. In other words:
by the time execution reaches the `plan_response` block, we already know the caller owns
this specific session. Owning the session that references a plan is a sufficient
authorization boundary for viewing that plan's read-only detail in this one bootstrap
context — re-checking plan ownership here is both redundant (given the session check
already ran) and wrong (it rejects the exact case this endpoint needs to support:
share-recipient sessions).

## The fix

Do NOT modify `GetWorkoutPlanDetail` or add a bypass flag to it — that use case is also
used by real plan-owner-only endpoints (`workouts/presentation/routes.py`) where the
ownership check must stay exactly as strict as it is today (rule 7 above).

Instead, in the bootstrap handler specifically, fetch the plan directly via the repository
(no ownership check), the same way `sharing/presentation/routes.py`'s
`resolve_and_access_shared_plan` handler already does — it fetches `plan =
plan_repo.get_by_id(share.workout_plan_id)` directly and never calls
`GetWorkoutPlanDetail.execute()`'s ownership-checked path either, which is exactly why
that endpoint already works for non-owners:

```python
if session.workout_plan_id:
    use_case_plan = GetWorkoutPlanDetail(plan_repo, workout_exercise_repo, day_repo, week_repo)
    plan = plan_repo.get_by_id(session.workout_plan_id)
    if not plan:
        raise WorkoutPlanNotFoundError(f"Plan {session.workout_plan_id} not found")
    plan_response = build_plan_detail_response(
        plan, session.workout_plan_id, use_case_plan, workout_exercise_repo, day_repo, week_repo, db
    )
```

Notes:
- `use_case_plan` (the `GetWorkoutPlanDetail` instance) is still constructed and still
  passed into `build_plan_detail_response` — it's needed there for its
  `get_effective_week()` helper method (used for weeks-type plans), which does not
  perform any ownership check and is unaffected by this change. Only the ownership-checked
  `.execute()` call is being removed from this handler.
  down needed — `WorkoutPlanNotFoundError` already has an existing global exception
  handler mapping it to `404` in `app.py`; confirm this before assuming you need to add
  one.
- The `_` (discarded exercises list) from the old `use_case_plan.execute()` call is not
  needed anywhere in this handler — confirm by reading the full function before and after
  your change that nothing downstream used it.
- This changes authorization for `GET /api/workout-sessions/{session_id}/bootstrap` for
  ALL callers, not just share recipients — but that's correct and intentional: the
  session-ownership check earlier in the same handler is already the real authorization
  boundary for this endpoint (you must own the session to see its bootstrap data at all);
  the extra plan-ownership check was always redundant for a normal (non-share) session too,
  since a normal session's plan is always owned by the same user as the session by
  construction. Removing it changes nothing for normal sessions and fixes share sessions.

## Required tests (add to `test_sharing_logging_phase4.py`)

1. **The exact regression scenario**: an authenticated recipient starts a session via
   share (reuse `share_log_permission_anyone` / `recipient_auth_headers` /
   `owner_plan_with_exercise` fixtures already in this file), then calls
   `GET /api/workout-sessions/{session_id}/bootstrap` with the recipient's own auth
   headers. Assert `200` (not 403), and assert the response contains the correct session
   data (`session.user_id == recipient`) AND correct plan data (plan name, the day, the
   exercise) — not just the status code.
2. **Confirm normal (non-share) sessions are unaffected**: if an existing test already
   covers `GET /api/workout-sessions/{session_id}/bootstrap` for a normal, non-share
   session succeeding for its owner, just confirm in your report that it still passes
   unmodified (search `tests/integration/test_sessions_routes.py` for `bootstrap` before
   assuming one doesn't exist). If none exists, add one.
3. **Confirm a genuine stranger (not the session owner, not via any share) still gets
   rejected**: a third user with no relationship to the session at all calls the bootstrap
   endpoint for someone else's session and gets `403` (this is the existing
   `UnauthorizedWorkoutSessionAccessError` path from the earlier session-ownership check,
   which this fix does not touch — confirm it still works).

## Acceptance criteria

- Full backend suite run twice: 252+ baseline passed / 4 pre-existing failures / 2 skipped,
  plus your new tests passing, no new failures anywhere. Paste both full run outputs.
- The exact live scenario (authenticated recipient's Active Workout screen loading
  successfully via share) must work — prove it with the new test, not just a claim.
- Plan-owner-only endpoints elsewhere (e.g. `GET /api/workout-plans/{plan_id}`) are
  provably unaffected — you did not touch `get_workout_plan_detail.py` or any workouts
  module file, so this should be true by construction; confirm via `git status` in your
  report.
- No migration, no push, no files outside the allowlist touched without stopping to ask.
