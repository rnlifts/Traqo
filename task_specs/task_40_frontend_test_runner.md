# Task 40 — Set up a real frontend test runner and cover the pure logic + key components

## Objective
The frontend currently has **zero working tests** despite one file that looks like a test (`frontend/src/utils/duration.test.ts`). Set up Vitest (the natural fit for this Vite project) + React Testing Library, rewrite that dead file as a real test, and add coverage across the pure-logic functions and key components built this session.

## Context
- `frontend/package.json` has no test runner installed at all (no vitest, no jest) and no `"test"` script. `duration.test.ts` uses `console.assert(...)` — this never fails a build, never returns a non-zero exit code, and isn't wired to run via any command. It is currently inert.
- This is a Vite + React 19 + TypeScript project (`frontend/package.json`, `frontend/vite.config.ts`). Vitest shares Vite's config/transform pipeline, so it needs minimal setup — no separate bundler config to maintain.
- No existing test-writing conventions exist on the frontend to follow (backend has `conftest.py` patterns — see Task 41's spec for that side). You're establishing the pattern here.

## Requirements

### 1. Install and configure Vitest + React Testing Library
- Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `jsdom` (or `happy-dom`) as dev dependencies.
- Add a Vitest config (either a `vitest.config.ts` or a `test` block inside `vite.config.ts`) using jsdom/happy-dom as the test environment.
- Add a `"test": "vitest run"` script to `package.json` (and optionally `"test:watch": "vitest"`).

### 2. Rewrite `duration.test.ts` as a real test
Convert the existing `console.assert` checks (7 cases already identified: basic conversions both directions, null input, zero input, high-minutes edge case) into real Vitest `describe`/`it`/`expect` blocks testing `secondsToHMS`/`hmsToSeconds` from `frontend/src/utils/duration.ts`. Keep the same test cases — they're already reasonable — just make them real, assertable tests that fail the build when wrong.

### 3. Add tests for other pure logic functions
Find and cover any other pure, framework-free utility functions in `frontend/src/utils/` and similar (grep for files with no React imports that export plain functions) — these are the cheapest, highest-value tests since they need no rendering/mocking.

### 4. Add component tests for key user-facing pieces built this session
Using React Testing Library, cover (at minimum):
- `frontend/src/features/auth/RegisterPage.tsx` — username format validation shows the right inline message for invalid input with zero network calls (mock `authApi.checkUsernameAvailability`), debounced availability check fires once for a settled value, Register button is disabled/enabled correctly based on `usernameStatus`.
- `frontend/src/features/sessions/ActiveWorkout.tsx` — Exit button shows Save & Exit / Discard, Save & Exit doesn't call the discard API, Discard requires confirmation before calling it.
- `frontend/src/pages/Dashboard.tsx` — unresolved-session banner shows/hides correctly based on mocked `getUnresolvedSession()`, Resume/Mark as Finished/Discard each call the right API.
- `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx` — "Create New Exercise" only shows when there's no exact-name match in results (Task 38's fix), search is debounced.
Mock API modules at the module boundary (e.g. `vi.mock('../../api/...')`) rather than hitting a real backend — these are frontend unit/component tests, not E2E (that's Task 43).

## Do NOT
- Do not attempt full coverage of every single component in the codebase in this task — prioritize the pieces listed in requirement 4 plus whatever pure utility functions exist. Broader component coverage can follow later.
- Do not set up Playwright here — that's Task 43, a different layer (E2E against a real running app, not unit/component tests with mocked APIs).
- Do not change any application code's behavior to make it "more testable" in a way that alters real functionality — if something is hard to test, prefer better test setup/mocking over changing production logic, and flag anything that seems to require an actual behavior change.

## Acceptance criteria
- [ ] `npm test` (or equivalent) runs Vitest and reports pass/fail with a real exit code.
- [ ] `duration.test.ts` is a real Vitest test file; deliberately breaking `secondsToHMS` or `hmsToSeconds` causes `npm test` to fail.
- [ ] At least the four components listed in requirement 4 have real test coverage for their key behaviors described above.
- [ ] Tests run in isolation (no dependency on a live backend, live database, or network) — verified by running them with the backend server stopped.
- [ ] No TypeScript errors.

## Review checklist
- [ ] Tests actually fail when the underlying logic is deliberately broken (spot-check at least one test by temporarily breaking the implementation and confirming the test catches it, then restoring it).
- [ ] No test suite takes an unreasonable amount of time to run (component tests with mocked APIs should be fast — seconds, not minutes).
