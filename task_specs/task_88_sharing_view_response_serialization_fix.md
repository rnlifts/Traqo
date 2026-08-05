# Task 88 — Fix 500 error viewing a shared plan with actual content (Task 86 Phase 3/4c)

## READ THIS FIRST — strict execution rules (non-negotiable)

1. **This is a narrow bugfix, not a rewrite.** Touch only the files in the allowlist below.
   If you believe another file must change, STOP and ask before touching it.
2. **A test that does not execute the code it claims to test is a task failure.** No
   placeholder assertions. Every test must call the real endpoint (TestClient) with a
   plan that actually has days/exercises on it, and assert on the real response body —
   not just the status code.
3. **Run, do not claim.** Run the FULL backend suite (`python -m pytest -q` from
   `backend/`) **twice**, paste both real outputs. Baseline before your change: **249
   passed, 4 failed (pre-existing, unrelated — listed below), 2 skipped**. After your fix:
   same 4 pre-existing failures, plus your new tests passing, no new failures.
4. **Known pre-existing failures — do not touch.** `test_start_workout_without_auth_fails`,
   `test_quick_start_without_auth_fails`, `test_bootstrap_without_auth_fails`,
   `test_create_share_unauthenticated` all assert 401 but get 403 (a pre-existing FastAPI
   `HTTPBearer` behavior mismatch, unrelated to sharing, confirmed present before Task 86
   even started). Out of scope. Do not modify these tests or `oauth2.py`.
5. **No database migration.** No schema change needed.
6. **No `git push`, no deploy.** Local commit only.

## File allowlist (do not touch anything else)

- `backend/src/modules/sharing/presentation/schemas.py` (modify — `SharedPlanResponse`
  only)
- `backend/src/modules/sharing/presentation/routes.py` (modify — only the
  `resolve_and_access_shared_plan` handler, i.e. `GET /api/shared/{token}`)
- `backend/tests/integration/test_sharing_access_routes.py` (add new tests)

If a fix requires touching `test_sharing_logging_phase4.py` fixtures too (e.g. reusing
`owner_plan_with_exercise`), importing that fixture into `test_sharing_access_routes.py`
via a shared conftest is NOT authorized — just duplicate the minimal fixture setup you
need directly in `test_sharing_access_routes.py`, following its existing local-fixture
style (see `owner_plan` in that file for the pattern).

## The bug

Reproduced live twice (including on a freshly restarted server, so it is not a stale-
process artifact) against the real dev database. Full repro: register a trainer + client,
trainer creates an exercise, a plan, **a day, and adds the exercise to the day** (i.e. a
plan with actual content — this is any real plan a user would build), shares it
`anyone`/`log`. Client calls `GET /api/shared/{token}` (just *viewing* the shared plan,
before logging anything) and gets:

```
{"error": "Internal server error"}
```

with this traceback in the server log:

```
File ".../src/modules/sharing/presentation/routes.py", line 423, in resolve_and_access_shared_plan
    return SharedPlanResponse(
pydantic_core._pydantic_core.ValidationError: 1 validation error for SharedPlanResponse
days.0
  Input should be a valid dictionary [type=dict_type, input_value=PlanDayDetailResponse(id=...
```

**Root cause:** `SharedPlanResponse` in `schemas.py` declares `days: list[dict] | None` and
`weeks: list[dict] | None`. But the route (`routes.py`, in `resolve_and_access_shared_plan`)
constructs it with `days=plan_detail_response.days, weeks=plan_detail_response.weeks` —
where `plan_detail_response` is a `WorkoutPlanDetailResponse` (from
`src/modules/workouts/presentation/schemas.py`) whose `.days` is actually
`list[PlanDayDetailResponse] | None` and `.weeks` is `list[PlanWeekDetailResponse] | None`
— real Pydantic model instances, not plain dicts. Only the `plan` field was correctly
converted (`plan=plan_detail_response.plan.model_dump()`); `days`/`weeks` were not.

**Why Phase 3's own tests never caught this:** every test in
`test_sharing_access_routes.py` uses the `owner_plan` fixture, which creates a bare
`WorkoutPlanModel` with **zero days added**. An empty list has no items for Pydantic to
type-check, so `days=[]` validates fine regardless of the declared item type being wrong.
The bug only triggers once a plan actually has at least one day — i.e. every real plan.
The existing assertions (`assert "days" in data or "weeks" in data`) only check the key
exists, never its actual content, so even a correct dict-shaped `days: []` would have
looked identical to a broken one in those tests.

## The fix

Preferred approach — make `SharedPlanResponse` correctly typed instead of loosely typed as
`dict`, matching how `WorkoutPlanDetailResponse` itself is built:

1. In `schemas.py`, import the real response models (the sharing module already imports
   from the workouts module elsewhere in `routes.py`, e.g. `build_plan_detail_response`,
   so a cross-module import here is consistent with existing patterns):
   ```python
   from src.modules.workouts.presentation.schemas import PlanDayDetailResponse, PlanWeekDetailResponse
   ```
   Change:
   ```python
   days: list[PlanDayDetailResponse] | None = None
   weeks: list[PlanWeekDetailResponse] | None = None
   ```
   (Leave `plan: dict` as-is — it already works correctly via `.model_dump()` in the route
   and is out of scope for this fix.)

2. In `routes.py`, `resolve_and_access_shared_plan`, no change should be needed to how
   `days`/`weeks` are passed once the schema's declared type is correct — but verify: since
   they're now real Pydantic model instances matching the declared type, FastAPI/Pydantic
   should accept them directly (`days=plan_detail_response.days`, unchanged). If you find
   you still need to convert them, use `.model_dump()` list comprehensions instead of
   changing the schema back to `dict` — the point of this fix is correctness, not just
   silencing the error.

3. Do not touch anything about `plan_owner_username`, `permission`, or `share` fields —
   they are unaffected and already correct.

## Required tests (add to `test_sharing_access_routes.py`)

1. **The exact regression scenario for `unit_type='days'` plans**: build a plan with at
   least one day that has at least one exercise on it (mirror the setup style already used
   in `test_sharing_logging_phase4.py`'s `owner_plan_with_exercise` fixture, but write it
   locally in this file per the allowlist note above). Share it, call
   `GET /api/shared/{token}` as an authenticated non-owner with access, assert `200` (not
   500), and assert the response body's `days` list actually contains the day with its
   exercise data (e.g. `data["days"][0]["exercises"][0]["exercise_id"] == <the exercise
   id>` or equivalent — do not just assert the key exists, assert real content, since
   that's exactly the gap that let this bug through last time).
2. **The same for `unit_type='weeks'` plans.** This code path (`weeks` field) has the
   identical bug pattern and, as far as we know, has never been exercised by any test with
   actual content — construct a minimal weeks-type plan with at least one week containing
   at least one day with an exercise, share it, and assert `200` with real `weeks` content
   in the response.
3. Confirm anonymous access to a non-empty `anyone`-mode plan still works (extend or add
   to an existing anonymous-access test if one already touches a plan with content; if all
   existing anonymous tests use the empty `owner_plan` fixture, add one that doesn't).

## Acceptance criteria

- Full backend suite run twice: 249+ baseline passed / 4 pre-existing failures / 2 skipped,
  plus your new tests passing, no new failures anywhere. Paste both outputs.
- `GET /api/shared/{token}` returns `200` with correct, real plan content (not just an
  empty shell) for both `days`-type and `weeks`-type plans.
- No migration, no push, no files outside the allowlist touched without stopping to ask.
