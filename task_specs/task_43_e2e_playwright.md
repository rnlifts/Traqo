# Task 43 — Playwright E2E for critical user journeys

## Objective
`@playwright/test` is already installed in `frontend/package.json` but completely unused — no spec files, no config. Set it up and write E2E tests for the critical journeys that, this whole project, have only ever been verified by manually running the app and clicking through it live. This formalizes that manual verification into something that runs automatically.

Depends on Tasks 40-42 ideally being in place first (so this slots into the same CI setup), but can be developed independently against a locally-running app.

## Context
- This is the layer that would have caught bugs that *only* surfaced when the real app was actually run — e.g. the FastAPI route-ordering collision (`/unresolved` shadowed by `/{session_id}`), the rate-limiter's missing `response: Response` parameter, `DeleteWorkoutPlan`'s stale constructor call site, the exercise-library fuzzy-search returning zero results against real seeded data, the Duration input overlap bug. None of those were caught by type-checking or unit tests — only by actually clicking through the running app. Playwright specs are the automated version of exactly that.
- Needs a real running backend + frontend + database — this is different from Tasks 40/41's mocked/isolated unit tests. Use a dedicated test database (not the shared local dev DB) so E2E runs don't pollute real data, and each test run should be able to start from a known-clean state.
- Reference the actual flows already built and manually verified this session for what to cover (see Requirements below) — these aren't hypothetical, they're the real features built across this project.

## Requirements

### 1. Playwright setup
- Add a Playwright config (`playwright.config.ts`) pointing at the app's local dev URLs (backend `:5000`, frontend `:5173` per this project's existing local setup).
- Decide and document a test-database strategy: a dedicated test Postgres DB (separate from local dev), reset/seeded to a known state before each test run (e.g. via the existing Alembic migrations + a minimal seed, or truncate-and-reseed between runs).
- A way to create a fresh test user per test run (registration flow itself is one of the things being tested, so this can double as setup).

### 2. Auth journey
Register (with a real username availability check against the running backend — this exercises Task 33's actual live endpoint, not a mock) → land on the success dialog → continue to login (pre-filled) → log in → land on Dashboard.

### 3. Session lifecycle journey
Quick-start a workout → log a set → Exit → Save & Exit → verify the Dashboard shows the unresolved-session banner → Resume → verify the previously-logged set is still there → Exit → Discard → verify the banner is gone and the plan's exercises/day still exist (session-only deletion, not plan deletion — this exact distinction was a deliberate design decision in Task 28/29, worth a real regression test). Separately: start a session, try to start a second one, confirm the 409 block redirects to Dashboard with the existing session's banner visible.

### 4. Plan + exercise library journey
Create a plan → use the exercise library sidebar to search (including a fuzzy-match case, e.g. searching a partial/differently-worded name and getting a real match) → add an exercise → configure its sets/reps/weight → save the plan → reopen it and confirm the data persisted correctly.

### 5. Plan deletion cascade journey
Create a plan, log a full session against it (so it has real history), delete the plan, and confirm via the UI that it's gone from the plan list and no longer appears in Workout History — this is the user-facing confirmation of the cascade-delete behavior Task 41 tests at the DB level; this test confirms it end-to-end through the actual UI.

## Do NOT
- Do not use these E2E tests as a substitute for Task 40/41's faster unit/component tests — they're deliberately slower and heavier, reserved for full-journey verification, not for testing every edge case of every function.
- Do not run these against the shared local dev database or (obviously) any production data — use a dedicated, disposable test database.
- Do not skip cleanup between test runs — each run should start from a predictable state, not accumulate junk data across runs the way manual testing sometimes did this session (recall the various leftover test plans/users created during live verification passes).

## Acceptance criteria
- [ ] All four journeys (auth, session lifecycle, plan+library, plan deletion cascade) pass against a real locally-running app.
- [ ] Tests are runnable with a single command (e.g. `npx playwright test`) and produce a clear pass/fail report.
- [ ] Deliberately breaking one of the flows (e.g. temporarily reintroducing the route-ordering bug, or making the 409 block not fire) causes the corresponding test to fail — verify this for at least one case to confirm the tests have real teeth, not just happy-path theater.
- [ ] Tests clean up after themselves or run against a database state that gets reset, so repeated runs don't accumulate junk or interfere with each other.

## Review checklist
- [ ] Test database is genuinely separate from local dev/production — verify by checking the connection string used in the Playwright config/setup.
- [ ] No test depends on manual setup steps not captured in the test itself (e.g. "first go create a user manually" — the test should do that itself).
- [ ] Tests are reasonably resilient to timing (using Playwright's built-in waiting/assertion retries) rather than hardcoded sleeps, given this project's own history of async-timing-related bugs (e.g. HMR reloads interrupting form state during earlier manual testing).
