# Task 93 — Sharing Phase 5c backend: allow edit-tier share grantees to edit a plan

## READ THIS FIRST — strict execution rules (non-negotiable)

This task is different in kind from Tasks 87/88/91/92: those fixed legitimate users being
incorrectly *blocked*. This one is about correctly *granting* write access to someone
else's data — a mistake here is a security bug (unauthorized editing), not just a UX bug.
Treat it accordingly.

1. **A test that does not execute the code it claims to test is a task failure.** No
   placeholder assertions. Every test must call the real endpoint (TestClient) and assert
   on actual behavior.
2. **Full coverage, not sampling.** Every one of the 10 endpoints listed below needs its
   own test proving: (a) an edit-tier grantee succeeds, (b) a view-or-log-tier grantee
   (NOT edit) is still rejected, (c) a stranger with no relationship to the plan or its
   share is still rejected, (d) the plan owner is unaffected. Do not test only a sample
   and assume the rest work by analogy — the whole point of this task's strictness is that
   analogy is not proof.
3. **Run, do not claim.** Run the FULL backend suite (`python -m pytest -q` from
   `backend/`) **twice**, paste both real outputs. Baseline before your change: **256
   passed, 4 failed (pre-existing, unrelated — listed below), 2 skipped.** After your
   change: same 4 pre-existing failures, plus your new tests passing, no new failures.
4. **Known pre-existing failures — do not touch.** `test_start_workout_without_auth_fails`,
   `test_quick_start_without_auth_fails`, `test_bootstrap_without_auth_fails`,
   `test_create_share_unauthenticated` all assert 401 but get 403 (pre-existing, unrelated
   to sharing, confirmed present before Task 86 even started). Do not touch these tests or
   `oauth2.py`.
5. **No database migration.** No schema change needed.
6. **No `git push`, no deploy.** Local commit only.
7. **Exhaustive checklist, no exceptions.** Section "The 10 in-scope endpoints" below is
   the complete, verified list — verified by tracing what the actual frontend plan-editor
   (`PlanBuilder.tsx`) calls, not by guessing from a grep of ownership-check patterns.
   Several endpoints that DO have a `plan.user_id != user_id` check are explicitly OUT of
   scope (listed below) because the edit UI never calls them — do not touch those, even
   though they look similar. If you find the frontend actually does call one of the
   "out of scope" endpoints and my trace was wrong, STOP and report it rather than
   changing scope unilaterally.
8. **One shared helper, not ten copies.** All 10 sites must call the same single helper
   function — do not write the authorization logic out longhand at each site.
9. **This does not add "anonymous edit."** Anonymous (unauthenticated) visitors with an
   edit-tier link permission are explicitly out of scope for the plan-builder UI (the
   builder assumes auth throughout) — this task only concerns *authenticated* non-owner
   users who hold an edit-tier grant or an edit-tier `anyone`-mode link while logged in.
   `get_current_user_id` (which requires auth) remains the dependency on all 10 endpoints
   — do not change any of them to use `get_optional_user_id`.

## The 10 in-scope endpoints (verified against `PlanBuilder.tsx`'s actual API calls)

All in `backend/src/modules/workouts/presentation/routes.py`:

| # | Method + path | Line (approx) | Use case | Notes |
|---|---|---|---|---|
| 1 | `GET /{plan_id}` | 528 | `GetWorkoutPlanDetail` | Loads the plan into the builder — without this, an edit-tier grantee can't even open the editor |
| 2 | `PUT /{plan_id}` | 545 | `UpdateWorkoutPlan` | |
| 3 | `POST /{plan_id}/days` | 571 | `CreateDay` | |
| 4 | `PUT /{plan_id}/days/{day_id}` | 617 | `UpdateDay` | |
| 5 | `POST /{plan_id}/days/{day_id}/exercises` | 727 | `AddExerciseToDay` | |
| 6 | `DELETE /{plan_id}/days/{day_id}/exercises/{workout_exercise_id}` | 756 | `RemoveExerciseFromDay` | |
| 7 | `PUT /{plan_id}/days/{day_id}/exercises/{workout_exercise_id}` | 789 | `UpdateExerciseInDay` | |
| 8 | `PUT /{plan_id}/days/{day_id}/exercises/{workout_exercise_id}/set-targets` | 843 | *(none — inline check in the route)* | No separate use case; the ownership check is directly in the route handler |
| 9 | `POST /{plan_id}/weeks/{week_number}/customize` | 916 | `CustomizeWeek` | |
| 10 | `POST /{plan_id}/weeks/{week_number}/match-previous` | 944 | `MatchPreviousWeek` | |

Line numbers are approximate — the file may have shifted slightly; use the method+path to
locate the real handler.

## Explicitly OUT OF SCOPE — do not touch (confirmed unused by the edit UI)

- `DELETE /{plan_id}` (`DeleteWorkoutPlan`) — only called from `PlanList.tsx`'s delete
  button, never from the builder. An edit-tier share must NOT be able to delete the whole
  plan.
- `GET /{plan_id}/days` (`ListDaysForPlan`) — unused by the builder.
- `DELETE /{plan_id}/days/{day_id}` (`DeleteDay`) — unused by the builder (there is no
  day-deletion feature reachable in the current UI).
- `GET /{plan_id}/days/{day_id}/previous-performance` — unused by the builder (used
  elsewhere, unrelated to editing).
- `POST /build` (`BuildPlan`) — this is the *create a brand-new plan* endpoint, always
  creates a plan owned by the caller; it is unrelated to editing an existing plan and is
  only called from create-mode, never edit-mode.
- Any exercise "move"/reorder endpoint — no reordering feature exists in the current
  builder UI; do not add authorization for it.

## Design: one shared helper, reused pattern from Tasks 87/91/92

The established pattern in this codebase (from `start_workout.py`'s
`skip_ownership_check` and `add_workout_set.py`'s `skip_exercise_ownership_check`) is: the
use case keeps its existing strict check, gated behind an optional boolean parameter that
defaults to preserving today's behavior. Follow that same pattern here, do not invent a
different one.

### Step 1 — new helper function in `workouts/presentation/routes.py`

Add a single module-level (private, `_`-prefixed) helper near the top of the file, close
to other route-level helper functions already in this file (e.g. `_build_workout_exercise_response`):

```python
def _caller_can_edit_plan(plan, user_id: int, db: Session) -> bool:
    """Return True if user_id owns the plan, or holds an edit-tier share grant on it.

    Used by plan-builder endpoints to let an authenticated share recipient with
    edit-tier permission edit a plan they don't own, alongside the plan's actual owner.
    """
    if plan.user_id == user_id:
        return True

    from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
        PlanShareRepositoryImpl,
    )
    from src.modules.sharing.application.use_cases.resolve_share_access import (
        ResolveShareAccess,
    )
    from src.modules.sharing.domain.exceptions import (
        ShareNotFoundError,
        ShareAccessDeniedError,
    )

    share_repo = PlanShareRepositoryImpl(db)
    share = share_repo.get_by_plan(plan.id)
    if not share or not share.is_active:
        return False

    resolver = ResolveShareAccess(share_repo)
    try:
        _, effective_permission = resolver.execute(share.token, user_id, plan.user_id)
    except (ShareNotFoundError, ShareAccessDeniedError):
        return False

    return effective_permission == "edit"
```

This reuses the already-built-and-tested `ResolveShareAccess` use case (Phase 3, Task 86)
rather than reimplementing tier-resolution logic — do not duplicate that logic here.

### Step 2 — each of the 9 use cases (everything except set-targets, which has no use case)

Add an optional `skip_ownership_check: bool = False` parameter to each use case's
`execute()` method (exact param name — reuse this name for consistency across the
codebase, don't invent a different one per use case), and wrap the existing
`if plan.user_id != requesting_user_id: raise UnauthorizedWorkoutPlanAccessError(...)`
check with `if not skip_ownership_check:`. This is mechanically the same change at each of
the 9 sites — apply it identically. Update each docstring's `Args`/`Raises` section to
document the new parameter, same style as `start_workout.py` already does.

**Special case — `GetWorkoutPlanDetail`**: this use case is also called from
`sessions/presentation/routes.py` (the bootstrap endpoint, fixed in Task 91 by bypassing
`.execute()` entirely) and from nowhere else that needs strict enforcement changed. Adding
`skip_ownership_check` here only affects callers that explicitly pass `True` — the
Task 91 bootstrap fix already avoids calling `.execute()` at all, so it is unaffected
either way. Confirm this by re-running the Task 91 regression tests specifically (see
Required Tests below).

### Step 3 — each of the 10 route handlers

In each handler, after fetching `plan` (all 10 already do this to check existence), call
the new helper and pass its result through:

```python
plan = plan_repo.get_by_id(plan_id)
if not plan:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout plan not found")
can_edit = _caller_can_edit_plan(plan, user_id, db)
```

For the 9 use-case-backed endpoints, pass `skip_ownership_check=can_edit` into
`use_case.execute(...)`. Do NOT remove or weaken the use case's own check — the point is
that `can_edit` is `False` for a non-owner without an edit grant, so the use case's
existing check still correctly rejects them; `can_edit` is only `True` when the caller is
either the owner OR holds a verified edit-tier grant.

For endpoint #8 (`set-targets`, no use case — the check is inline in the route), replace:
```python
if plan.user_id != user_id:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
```
with:
```python
if not _caller_can_edit_plan(plan, user_id, db):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
```

## Required tests

Add a new test file `backend/tests/integration/test_plan_edit_via_share.py`. For EACH of
the 10 endpoints in the table above, write (at minimum) these 4 tests using real fixtures
(an owner, a plan with at least one day and one exercise so all 10 endpoints have valid
targets to act on, an `edit`-tier share — both via `anyone`-mode link and via a specific
username grant, at least once each across the suite — and a `view`-or-`log`-tier
counterpart, and a genuine stranger with no grant and no relationship to the share at
all):

1. Plan owner: succeeds (sanity check — must still work exactly as before).
2. Edit-tier grantee (not the owner): succeeds.
3. View-tier or log-tier grantee (not edit): rejected with `403`.
4. Stranger (authenticated, but no grant, not `anyone`-mode, no relationship to this
   plan's share at all): rejected with `403`.

That's 40 test cases minimum (10 endpoints × 4). Group them sensibly (e.g. one test class
per endpoint, or parametrize where the codebase's existing test style supports it — check
`test_sharing_logging_phase4.py` and `test_workouts_routes.py` for the prevailing style in
this codebase and match it) — the goal is genuine coverage, not artificial padding, so
prefer parametrization over 40 near-identical copy-pasted functions if that keeps the
suite readable.

Additionally:
5. **Revoked-share regression test**: an edit-tier grantee is correctly allowed while the
   share is active, then the owner revokes the share, then the same user's edit attempt on
   any one of the 10 endpoints is now rejected with `403`.
6. **Re-run the exact Task 91 regression scenario** (`TestBootstrapViaShare` in
   `test_sharing_logging_phase4.py`) as part of your verification — not a new test, just
   confirm it still passes, to prove this change didn't interfere with the bootstrap fix's
   use of `GetWorkoutPlanDetail`.

## Acceptance criteria

- Full backend suite run twice: 256+ baseline passed / 4 pre-existing failures / 2
  skipped, plus all new tests passing, no new failures anywhere. Paste both full run
  outputs.
- All 10 endpoints from the table are provably covered — in your report, list each of the
  10 and confirm all 4 scenarios were tested for it.
- The two explicitly-out-of-scope-but-similar-looking endpoints
  (`DeleteWorkoutPlan`, `DeleteDay`) are confirmed UNCHANGED — an edit-tier grantee must
  still be unable to delete the plan or a day (there is no requirement to test this
  explicitly since you're not touching those files, but do not accidentally touch them).
- No migration, no push, no files outside `workouts/presentation/routes.py` and the 9 use
  case files listed touched without stopping to ask first.
