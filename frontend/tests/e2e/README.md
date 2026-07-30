# Playwright E2E Tests

End-to-end tests for Traqo's critical user journeys, using a dedicated test database.

## Setup

### 1. Environment Variables

Set up a dedicated test database (not the local dev database):

```bash
# .env.local or export before running tests
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost/traqo_test"
```

The test database must exist but can be empty — Alembic migrations will set up the schema automatically.

### 2. Backend & Frontend

Tests start the backend and frontend automatically via Playwright's `webServer` config, but you can also run them manually:

```bash
# Terminal 1: Backend (from backend/)
python run.py

# Terminal 2: Frontend (from frontend/)
npm run dev
```

## Running Tests

### Run all E2E tests

```bash
npm run test:e2e
```

### Run specific test file

```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests in headed mode (see browser)

```bash
npx playwright test --headed
```

### View test report

```bash
npx playwright show-report
```

## Test Structure

### Completed (Phase 1-4)

- **`auth.spec.ts`** — Auth Journey: register (real username check) → login → dashboard
- **`session-lifecycle.spec.ts`** — Session Journey: quick-start → log set → save → resume → discard → verify plan intact
- **`plan-and-library.spec.ts`** — Plan + Library: create plan → search exercises (fuzzy) → add → configure sets/reps/weight → save → reopen & verify
- **`plan-deletion.spec.ts`** — Plan Cascade: create → log session → delete → verify gone from plan list and history

## Database Setup

1. **Global Setup** (`global-setup.ts`): Runs once before all tests
   - Executes Alembic migrations against `TEST_DATABASE_URL`
   - Ensures schema is up-to-date

2. **Per-Test Cleanup**: Database state persists across tests
   - Each test should create its own test users/data
   - Tests don't interfere if using unique usernames (timestamp-based)

## Key Files

- `playwright.config.ts` — Playwright configuration (baseURL, webServer, global-setup)
- `global-setup.ts` — Runs migrations before all tests
- `fixtures/user.ts` — Test user helpers (generateTestUser, registerUser, loginUser)
- `fixtures/db-setup.ts` — Database utilities (for future use in other journeys)

## Common Issues

### Tests fail with connection refused

- Ensure `TEST_DATABASE_URL` points to a valid Postgres instance
- Ensure the database exists: `createdb traqo_test`
- Ensure backend is accessible on `http://localhost:5000`
- Ensure frontend is accessible on `http://localhost:5173`

### Migrations fail

- Check that Alembic is installed: `pip install alembic sqlalchemy`
- Check backend `migrations/env.py` is configured correctly
- Run migrations manually to debug: `DATABASE_URL=... alembic upgrade head` (from `backend/migrations/`)

### Username already exists error

- Test usernames are timestamp-based (e.g., `testuser1722308400123`)
- Each test run uses unique usernames, so this shouldn't happen
- If persisting, check `TEST_DATABASE_URL` is actually a separate test database

## Implementation Notes

### Fixtures & Helpers

- `fixtures/user.ts` provides test user generation and auth helpers
  - `generateTestUser()` — Creates unique test user with timestamp-based username
  - `registerAndLogin()` — Registers and logs in a user in one call
  - `quickStartWorkout()` — Starts a quick-start workout and returns session ID

### Set Logging & Verification

- Sets are rendered as circular "pips" showing the set number (1, 2, 3...) or a checkmark (✓) if logged
- Clicking a pip opens the set logging panel where you can enter weight, reps, duration, and notes
- The panel has a "Log Set" button to save the set
- After logging, the pip updates to show a checkmark indicating completion

### Plan Deletion Cascade

- Deleting a plan via the UI triggers a cascade delete on the backend
- Verified by checking the plan no longer appears in:
  - The plan list page (`/workout-plans`)
  - The recent workouts section on the dashboard
  - The full workout history view (if accessible)
