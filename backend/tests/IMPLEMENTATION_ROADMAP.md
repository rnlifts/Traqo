# Task 41 Backend Test Coverage — Implementation Roadmap

## Overview
This document tracks the implementation of comprehensive pytest test coverage across all backend modules (auth, sessions, workouts, exercises, exercise_library) with both unit tests (in-memory doubles) and route-level integration tests (TestClient).

**Status as of 2026-07-29:** Phases 1, 7 (example), and 8 (example) complete. Phases 2–6 pending, plus additional Phase 7 routes and Phase 9 verification.

---

## Completed Phases

### Phase 1: Test Infrastructure ✓
**Goal:** Create in-memory repository doubles and shared test fixtures.

**Files created:**
- `backend/tests/conftest.py` — Enhanced with 5 in-memory repository doubles:
  - `InMemoryWorkoutSessionRepository`
  - `InMemoryWorkoutSetRepository`
  - `InMemoryPlanDayRepository`
  - `InMemoryPlanWeekRepository`
  - `InMemoryExerciseLibraryItemRepository`
  - Plus corresponding pytest fixtures

**Status:** Complete. All doubles compile and match interface contracts exactly.

---

### Phase 7a: Exercise Library Route Tests ✓
**Goal:** Demonstrate route-level integration pattern with TestClient.

**File created:**
- `backend/tests/integration/test_exercise_library_routes.py` — 8 tests:
  - Auth requirement (401 without JWT)
  - Empty library handling
  - Query-based search
  - Muscle group filtering
  - Distinct muscle group retrieval

**Status:** Complete. Demonstrates pattern for Phase 7b/c.

---

### Phase 8: Cascade Delete Test ✓
**Goal:** Verify ON DELETE CASCADE behavior with real Postgres.

**File created:**
- `backend/tests/integration/test_cascade_deletes.py` — 2 tests:
  - Plan deletion cascades to days, sessions, sets (exercises preserved)
  - Exercise preservation on plan deletion

**Status:** Complete. Uses real Postgres fixture (requires `TEST_DATABASE_URL` env var).

---

## Pending Phases

### Phase 2: Auth Unit Tests
**Goal:** Test RegisterUser and LoginUser use cases, plus UsernameValidator.

**File to create:** `backend/tests/unit/test_auth.py`

**Tests needed:**
- RegisterUser:
  - Happy path: valid name/username/password → user created with bcrypt hash
  - Username uniqueness constraint
  - Short/long password rejection
  - Invalid username format (non-alphanumeric, starts with number, etc.)
- LoginUser:
  - Valid credentials → token returned
  - Invalid password → AuthenticationError
  - User not found → AuthenticationError
- UsernameValidator:
  - Format validation (3–20 chars, alphanumeric + underscore, starts with letter)
  - Already exists check (via mock repository)

**Fixtures to use:** `in_memory_exercise_repo` (for exercise-dependent tests), standard `user_id`

**Key regression test:** Username format validation must catch bugs that wouldn't be caught by integration tests alone.

---

### Phase 3: Exercises Unit Tests
**Goal:** Test exercise CRUD use cases.

**File to create:** `backend/tests/unit/test_exercises.py`

**Tests needed:**
- CreateExercise:
  - Happy path: creates exercise owned by user
  - Duplicate name within user → error
  - Different user can use same name
- ListExercises:
  - Lists only user's exercises
  - Excludes other users' exercises
  - Sorted order (name?)
- DeleteExercise:
  - Happy path: deletes exercise
  - ExerciseInUseError when exercise is in a plan
  - Only owner can delete (authorization check)

**Fixtures to use:** `in_memory_exercise_repo`, `user_id`, `another_user_id`

**Key regression test:** ExerciseInUseError guard must prevent mid-workout exercise deletions.

---

### Phase 5: Workouts Unit Tests
**Goal:** Test workout plan CRUD, days, weeks, and related use cases.

**File to create:** `backend/tests/unit/test_workouts.py`

**Tests needed:**
- CreateWorkoutPlan:
  - Happy path: creates plan with user_id
  - Initial days/weeks creation (based on unit_type)
- ListWorkoutPlans:
  - Lists only user's plans
  - Excludes other users' plans
- UpdateWorkoutPlan:
  - Updates name, unit_type, total_units
  - Respects user ownership
- DeleteWorkoutPlan:
  - Happy path: deletes plan
  - Sessions exist check: DeleteWorkoutPlanError if any session exists
- PlanDayRepository:
  - Create, list_by_plan (sorted by order_position), update, delete
- PlanWeekRepository:
  - Create, list_by_plan (sorted by week_number), get_by_plan_and_week_number
- AddExerciseToDay:
  - Adds workout_exercise to plan_day
  - Increments order_number
  - Field presence flags (has_reps, has_weight, has_duration)
- RemoveExerciseFromDay:
  - Removes workout_exercise
  - Reorders remaining exercises
- UpdateWorkoutExercise:
  - Updates target sets/reps/weight and field flags
  - Preserves id and order_number

**Fixtures to use:** `in_memory_plan_repo`, `in_memory_workout_exercise_repo`, `in_memory_day_repo`, `in_memory_week_repo`, `in_memory_exercise_repo`, `user_id`

**Key regression test:** DeleteWorkoutPlanError guard must prevent plan deletion when sessions exist.

---

### Phase 6: Sessions Unit Tests
**Goal:** Test workout session logging, set tracking, and history retrieval.

**File to create:** `backend/tests/unit/test_sessions.py`

**Tests needed:**
- StartWorkout:
  - Happy path: creates session from plan, links to day/week, prefills with previous performance
  - UnresolvedSessionExistsError blocks second session start
  - Previous performance lookup (most recent finished session for day)
- QuickStartWorkout:
  - Happy path: creates session without plan, allows inline exercise config
  - Inline field-presence config (has_reps, has_weight, has_duration)
- AddWorkoutSet:
  - Happy path: creates set, next_set_number computed from count_by_session_and_exercise
  - Upsert logic: get_by_session_exercise_and_set_number for overwrite
  - Field validation: permissive (one of weight/reps/duration non-null)
- DeleteWorkoutSet:
  - Removes set by id
  - Resets set_numbers for remaining sets in exercise
- FinishWorkout:
  - Sets completed_at timestamp
  - Clears unresolved session status
- DiscardWorkoutSession:
  - Deletes session and all sets
  - Clears unresolved status
- GetUnresolvedSession:
  - Finds most recent unresolved session for user
  - Returns None if no unresolved session
  - Used to display banner on Dashboard
- GetWorkoutSessionDetail:
  - Returns session with all sets grouped by exercise
  - Includes previous performance data
- GetWorkoutHistory:
  - Lists finished sessions sorted by started_at (descending)
  - Includes set data
  - Paginated (limit/offset)
- GetExerciseProgress:
  - Returns all sets for exercise across finished sessions
  - 1RM estimation via Epley formula: 1RM = weight × (1 + reps/30)
  - PR (personal record) detection: max weight per rep count
  - Volume trends: total weight per session
- ExceptionHandling:
  - UnresolvedSessionExistsError when starting second session

**Fixtures to use:** `in_memory_session_repo`, `in_memory_set_repo`, `in_memory_day_repo`, `in_memory_exercise_repo`, `user_id`, utility for Epley calculation

**Key regression test:** UnresolvedSessionExistsError must prevent concurrent sessions (only one active workout at a time).

---

### Phase 7b: Auth Routes Integration Tests
**File to create:** `backend/tests/integration/test_auth_routes.py`

**Tests needed:**
- Register endpoint:
  - POST /api/auth/register with valid data → 201, user returned
  - Duplicate username → 400
  - Invalid password → 400
- Login endpoint:
  - POST /api/auth/login with valid credentials → 200, token returned
  - Invalid password → 401
  - User not found → 401
- Rate limiter verification:
  - Multiple failed logins → 429 (too many requests)
  - **CRITICAL REGRESSION TEST:** Remove `response: Response` parameter from rate-limiter decorator → test should fail with 500 (this was the actual bug from Task 33). Re-add parameter and verify test passes.

**Key pattern:** Unlike unit tests, these hit the actual FastAPI app via TestClient, catching decorator bugs, route-registration bugs, and request/response pipeline bugs.

---

### Phase 7c: Sessions Routes Integration Tests
**File to create:** `backend/tests/integration/test_sessions_routes.py`

**Tests needed:**
- POST /api/sessions (start workout):
  - Valid plan_id → 201, session returned
  - Unresolved session exists → 409 UnresolvedSessionExistsError
- GET /api/sessions/{session_id}:
  - Valid session → 200, detail returned
  - Invalid session_id → 404
- POST /api/sessions/{session_id}/sets (add set):
  - Valid data → 201, set returned
  - Set upsert logic (same exercise + set_number overwrites)
- DELETE /api/sessions/{session_id}/sets/{set_id}:
  - Valid set_id → 204
  - Invalid set_id → 404
- POST /api/sessions/{session_id}/finish:
  - Valid session → 200, marked as completed
  - Already finished → 400 (idempotency)
- POST /api/sessions/{session_id}/discard:
  - Valid session → 200, deleted
  - Also clears unresolved status
- **GET /api/sessions/unresolved (CRITICAL REGRESSION TEST):**
  - Currently registered AFTER /{session_id}, so it shadows and never matches
  - Test must call real route and verify it works
  - Temporarily reorder routes in routes.py so /unresolved comes AFTER /{session_id} → test should fail (404 or wrong route hit)
  - Restore correct order → test passes
  - This catches route-registration bugs that unit tests cannot detect

---

### Phase 7d: Exercise Library Routes Integration Tests
**File to create:** `backend/tests/integration/test_exercise_library_routes.py` (already created)

**Status:** 8 tests implemented. No additional tests needed for Phase 7.

---

### Phase 9: Verification with Historical Bug Reproduction
**Goal:** Prove integration tests catch bugs that unit tests miss.

**Acceptance criteria:**
1. Temporarily remove `response: Response` parameter from auth rate-limiter:
   - test_auth_routes.py tests should FAIL (500 on decorated route)
   - Restore parameter, tests should PASS
2. Temporarily reorder sessions routes so GET /unresolved comes AFTER GET /{session_id}:
   - test_sessions_routes.py::test_get_unresolved should FAIL (route shadowing)
   - Restore correct order, test should PASS
3. All other tests pass without modification

**Proof:** These bugs would NOT be caught by unit tests (which call use cases directly, not through routes). This demonstrates why route-level integration tests are essential.

---

## Implementation Order

1. **Phase 2** (Auth) — 30–45 min
2. **Phase 3** (Exercises) — 20–30 min
3. **Phase 5** (Workouts) — 60–90 min (largest)
4. **Phase 6** (Sessions) — 60–90 min (largest, includes Epley formula, PR detection)
5. **Phase 7b** (Auth Routes) — 20–30 min
6. **Phase 7c** (Sessions Routes) — 30–45 min
7. **Phase 9** (Verification) — 15–20 min

**Total estimated time:** 4–5 hours for full implementation + verification.

---

## Key Testing Patterns Established

### In-Memory Doubles (Unit Testing)
- Repository doubles store entities in `self.{entities_dict}`
- Auto-incrementing IDs assigned on create/add
- Sorting/filtering logic matches real repository behavior
- No external I/O (pure in-memory)
- Used with fixtures from conftest.py

### Route Integration Testing (TestClient)
- Real FastAPI app with TestClient (no mocking)
- Auth headers obtained via register + login before each test
- Database state managed by test_db_session fixture (SQLite, in-memory)
- Tests HTTP status codes, response structure, error handling
- Catches decorator bugs, route-registration bugs, request-pipeline bugs

### Cascade Delete Testing (Postgres)
- Real Postgres instance (separate from unit/integration test DBs)
- Setup all tables via Base.metadata.create_all()
- Verify cascade behavior at database layer
- Proof that ON DELETE CASCADE is properly configured in models

---

## Notes

- **SQLAlchemy models** already define all foreign key relationships with `cascade="all, delete-orphan"` where needed (verify before running cascade tests).
- **Epley formula** for 1RM estimation: `1RM = weight × (1 + reps / 30)`. Implement as a utility function in `src/utils/epley.py` or inline in use case.
- **PR detection:** For each unique rep count, find max weight logged. Store alongside 1RM data in response.
- **Fuzzy search** (exercise library) uses token-overlap matching: splits query and names into words, counts matching words. Short words (< 3 chars) require exact match to prevent false positives.
- **Rate limiter** (auth) uses `response: Response` parameter to return 429 with Retry-After header. Missing parameter → 500 on every request (the actual bug from Task 33).
- **Route shadowing bug** (sessions) happens when `/unresolved` is registered after `/{session_id}`. The framework matches `/{session_id}` first and never reaches `/unresolved`. Correct order: longest/most-specific routes first.
