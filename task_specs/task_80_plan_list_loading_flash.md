# Task 80 — Fix full-page loading flash on the Workout Plans list

## Objective
Navigating to the Workout Plans page always does a fresh `GET /workout-plans` (expected — there's no caching layer, same as Dashboard and Workout History). The problem is *how* the loading state is rendered while that fetch is in flight.

Dashboard ([`frontend/src/pages/Dashboard.tsx:131`](../frontend/src/pages/Dashboard.tsx)) and Workout History ([`frontend/src/pages/WorkoutHistoryPage.tsx:36`](../frontend/src/pages/WorkoutHistoryPage.tsx)) both scope their loading state to just the list section — the page title/header stays mounted and visible the whole time, only the list area shows a small loading placeholder.

Workout Plans (`frontend/src/features/workoutPlans/PlanList.tsx:69`) instead does:
```tsx
if (loading) return <div className="loading">Loading workout plans...</div>;
```
This is a full early-return *before* rendering anything else in the component — it wipes out the "Your ledger" kicker, "Workout Plans" title, and the `PlanActionCards` (Log Workout / Create Plan buttons), not just the plan grid. This makes navigating to this page feel like a much bigger reload than Dashboard or Workout History, even though the underlying fetch is the same kind of call.

## Required changes
In `frontend/src/features/workoutPlans/PlanList.tsx`:
- Remove the early-return `if (loading) return <div className="loading">...</div>;` at line 69.
- Render the page shell (kicker, title, error banner, `PlanActionCards`, "Saved plans" section label) unconditionally, same as it already does for the non-loading case.
- Scope the loading indicator to only the plan-grid area — where `plans.length > 0 ? (...) : (...)` currently is, add a loading branch there instead: `loading ? <div className="loading">Loading workout plans...</div> : plans.length > 0 ? (...) : (...)`. Match the pattern already used in `frontend/src/features/sessions/WorkoutHistory.tsx` (the component `WorkoutHistoryPage.tsx` delegates loading/error/empty rendering to) for how the loading/empty/populated branches are structured, for consistency.

## Do NOT
- Do not change `Dashboard.tsx` or `WorkoutHistoryPage.tsx` / `WorkoutHistory.tsx` — they already follow the correct pattern and are the reference, not the target.
- Do not add any client-side caching or change when the fetch fires (still fetch fresh on every mount of `PlanList`) — this task is only about what renders while that fetch is in flight, not about avoiding the fetch.
- Do not touch `PlanBuilder.tsx` or anything related to Task 79 — that's a separate, already-spec'd fix for a different problem (edit-mode reload-per-mutation). This task is scoped only to `PlanList.tsx`.

## Required tests
Per current testing policy, add new tests, not just confirm existing ones pass:
- A test that renders `PlanList` with the `listWorkoutPlans` mock unresolved (pending promise) and asserts the page title ("Workout Plans") and `PlanActionCards` content are present in the DOM *during* the loading state — this is the regression test for the exact bug (title/action-cards should never disappear).
- A test that resolves `listWorkoutPlans` with a populated list and asserts the loading placeholder is gone and the plan grid renders — confirms the loading→loaded transition doesn't leave stale loading text.
- A test that resolves `listWorkoutPlans` with an empty list and asserts the existing "Nothing saved yet..." empty-state message still renders correctly (unchanged behavior, just confirming the branch restructuring didn't break it).

## Acceptance criteria
- [ ] Navigating to `/workout-plans` shows the title, kicker, and action cards immediately; only the plan-grid area shows a loading placeholder while the fetch is in flight.
- [ ] Empty-state and populated-state rendering are otherwise unchanged from current behavior.
- [ ] Full frontend test suite passes with the new tests included; `npx tsc -b` clean.

## Review checklist
- [ ] Diff touches only `frontend/src/features/workoutPlans/PlanList.tsx` and its test file.
- [ ] Live-verify: navigate Dashboard → Workout Plans and confirm the title/action-cards no longer flash away during the fetch.
