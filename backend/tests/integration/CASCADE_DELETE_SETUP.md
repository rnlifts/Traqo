# Cascade Delete Integration Test Setup

## Overview

The cascade delete integration test (`test_cascade_deletes.py`) validates that the production Postgres schema has correct `ON DELETE CASCADE` constraints by running actual Alembic migrations against a real Postgres instance — **not** just `Base.metadata.create_all()`.

## Why Alembic Migrations Matter

The cascade delete test must run migrations, not model-based schema creation, because:

1. **Schema Drift Detection**: SQLAlchemy models may lack `ondelete='CASCADE'` declarations even if migrations have them (or vice versa)
2. **Production Validation**: The test validates what's actually deployed, not just what models say
3. **Regression Detection**: A future developer could accidentally break ON DELETE CASCADE in a migration, and this test catches it

Using `Base.metadata.create_all()` would create an incomplete schema based only on model definitions, missing the real migration constraints — defeating the purpose of the test.

## Running the Test

The test requires a real Postgres instance and `TEST_DATABASE_URL` environment variable:

```bash
# Linux/Mac:
export TEST_DATABASE_URL="postgresql://user:password@localhost/test_db"
pytest tests/integration/test_cascade_deletes.py -xvs

# Windows PowerShell:
$env:TEST_DATABASE_URL = "postgresql://user:password@localhost/test_db"
python -m pytest tests/integration/test_cascade_deletes.py -xvs
```

### Database Requirements

- Postgres instance accessible at the URL in `TEST_DATABASE_URL`
- User must have permissions to `DROP SCHEMA public CASCADE` and `CREATE SCHEMA public`
- Database name in URL must exist (test creates/drops public schema, not the database itself)

### Without TEST_DATABASE_URL

If `TEST_DATABASE_URL` is not set, tests skip gracefully:

```
tests/integration/test_cascade_deletes.py::TestCascadeDeletes::test_delete_plan_cascades_to_days_sessions_sets SKIPPED
```

This is by design — the tests are optional and only run when explicitly configured.

## What the Test Validates

### Test 1: `test_delete_plan_cascades_to_days_sessions_sets`

Deletes a workout plan and verifies:
- ✅ PlanDays are deleted (CASCADE from plan → days)
- ✅ WorkoutSessions are deleted (CASCADE from day → sessions)
- ✅ WorkoutSets are deleted (CASCADE from session → sets)
- ✅ Exercises are **NOT** deleted (no CASCADE from plan to exercises — correct, exercises are reusable)

### Test 2: `test_cascade_delete_preserves_exercises`

Confirms exercises survive plan deletion (they're shared resources, not owned by a plan).

## Integration with Phase 9 (Verification)

The cascade delete test is critical for Phase 9's regression verification:

1. Temporarily remove `ondelete='CASCADE'` from a migration
2. Re-run the test → it should **fail** (constraint violated)
3. Restore `ondelete='CASCADE'`
4. Re-run the test → it should **pass**

This proves integration tests catch schema-level bugs that unit tests cannot.

## Known Limitations

- **Slow**: Migrations take seconds; not suitable for running on every commit
- **Postgres-only**: Cannot test with SQLite (which doesn't support CREATE/DROP SCHEMA)
- **Requires Alembic path setup**: The fixture finds migrations/ relative to test file location

These tradeoffs are acceptable because:
- Tests run only when `TEST_DATABASE_URL` is set (opt-in)
- Validates production behavior, not just unit test doubles
- Catch drift between models and migrations (a real risk)
