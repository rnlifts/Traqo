"""Integration tests for cascade delete behavior using real Postgres.

These tests run the actual Alembic migrations against a real Postgres instance
to validate that ON DELETE CASCADE constraints are properly configured in the
production schema. This catches drift between SQLAlchemy models and migrations.

Note: Requires TEST_DATABASE_URL environment variable. Run with:
  TEST_DATABASE_URL="postgresql://user:password@localhost/test_db" pytest tests/integration/test_cascade_deletes.py
"""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel
from src.modules.sessions.infrastructure.models.workout_set_model import WorkoutSetModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel


def get_postgres_url():
    """Get Postgres test database URL from environment or skip if not available."""
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set. Skipping Postgres cascade-delete tests.")
    return url


def run_alembic_migrations(db_url: str):
    """Run Alembic migrations against the given database URL.

    This must run as a genuinely separate subprocess, not in-process via
    alembic's Python API. migrations/env.py always reads settings.DATABASE_URL
    (the DATABASE_URL env var) rather than whatever URL Alembic's Config
    object was given — and since `settings` is a pydantic-settings singleton
    that's likely already been constructed elsewhere in this same pytest
    process (e.g. via an earlier `from src.app import app`), mutating
    os.environ at this point is too late to affect it. A subprocess reads
    DATABASE_URL fresh from its own environment at startup, same as the
    manual `DATABASE_URL="..." python -m alembic upgrade head` workflow
    already documented in CLAUDE.md.
    """
    migrations_dir = Path(__file__).parent.parent.parent / "migrations"
    backend_dir = migrations_dir.parent

    env = os.environ.copy()
    env["DATABASE_URL"] = db_url

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(migrations_dir),
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Alembic migration failed (exit {result.returncode}):\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


@pytest.fixture(scope="function")
def postgres_db():
    """Provide a real Postgres test database with Alembic migrations applied.

    This fixture:
    1. Creates a clean test database
    2. Runs Alembic migrations (not just create_all) to get the real production schema
    3. Yields a session for testing
    4. Cleans up after the test

    This ensures we test against the actual migrated schema, catching drift between
    SQLAlchemy models and migration definitions.
    """
    db_url = get_postgres_url()

    engine = create_engine(db_url, echo=False)

    # Drop all tables to start fresh
    with engine.connect() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        connection.commit()

    # Run Alembic migrations to build the real schema
    run_alembic_migrations(db_url)

    # Create session factory for the migrated database
    TestSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSessionLocal()

    yield session

    session.close()

    # Cleanup: drop schema
    with engine.connect() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.commit()

    engine.dispose()


def now_utc():
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


class TestCascadeDeletes:
    """Tests for cascade delete behavior at the database level."""

    def test_delete_plan_cascades_to_days_sessions_sets(self, postgres_db: Session):
        """Deleting a plan cascades to days, sessions, and sets via ON DELETE CASCADE."""
        # Setup: Create a test user
        user = UserModel(
            username="testuser",
            display_name="Test User",
            password_hash="fake_hash",
        )
        postgres_db.add(user)
        postgres_db.flush()

        plan = WorkoutPlanModel(
            user_id=user.id,
            name="Test Plan",
            unit_type="days",
            total_units=1,
        )
        postgres_db.add(plan)
        postgres_db.flush()

        # Create days
        day = PlanDayModel(
            workout_plan_id=plan.id,
            label="Day 1",
            order_position=1,
            is_rest=False,
        )
        postgres_db.add(day)
        postgres_db.flush()

        # Create exercises
        exercise = ExerciseModel(
            user_id=user.id,
            name="Bench Press",
        )
        postgres_db.add(exercise)
        postgres_db.flush()

        # Add exercise to day
        workout_exercise = WorkoutExerciseModel(
            plan_day_id=day.id,
            exercise_id=exercise.id,
            order_number=1,
            target_sets=3,
            target_reps="10",
            target_weight=185.0,
            has_reps=True,
            has_weight=True,
            has_duration=False,
        )
        postgres_db.add(workout_exercise)
        postgres_db.flush()

        # Create a session
        workout_session = WorkoutSessionModel(
            user_id=user.id,
            workout_plan_id=plan.id,
            plan_day_id=day.id,
            plan_week_id=None,
            started_at=now_utc(),
            completed_at=now_utc(),
        )
        postgres_db.add(workout_session)
        postgres_db.flush()

        # Log a set
        workout_set = WorkoutSetModel(
            workout_session_id=workout_session.id,
            exercise_id=exercise.id,
            set_number=1,
            weight=185.0,
            reps=10,
            duration_seconds=None,
        )
        postgres_db.add(workout_set)
        postgres_db.commit()

        # Verify records exist
        assert postgres_db.query(WorkoutPlanModel).count() == 1
        assert postgres_db.query(PlanDayModel).count() == 1
        assert postgres_db.query(WorkoutSessionModel).count() == 1
        assert postgres_db.query(WorkoutSetModel).count() == 1

        # Delete the plan
        postgres_db.delete(plan)
        postgres_db.commit()

        # Verify cascades deleted everything
        assert postgres_db.query(WorkoutPlanModel).count() == 0
        assert postgres_db.query(PlanDayModel).count() == 0
        assert postgres_db.query(WorkoutSessionModel).count() == 0
        assert postgres_db.query(WorkoutSetModel).count() == 0

        # Exercise should NOT be deleted (no cascade from plan to exercise)
        assert postgres_db.query(ExerciseModel).count() == 1

    def test_cascade_delete_preserves_exercises(self, postgres_db: Session):
        """Deleting a plan should NOT delete exercises (no foreign key cascade)."""
        user = UserModel(
            username="testuser",
            display_name="Test User",
            password_hash="fake_hash",
        )
        postgres_db.add(user)
        postgres_db.flush()

        plan = WorkoutPlanModel(
            user_id=user.id,
            name="Test Plan",
            unit_type="days",
            total_units=1,
        )
        postgres_db.add(plan)
        postgres_db.flush()

        day = PlanDayModel(
            workout_plan_id=plan.id,
            label="Day 1",
            order_position=1,
            is_rest=False,
        )
        postgres_db.add(day)
        postgres_db.flush()

        exercise = ExerciseModel(
            user_id=user.id,
            name="Bench Press",
        )
        postgres_db.add(exercise)
        postgres_db.flush()

        workout_exercise = WorkoutExerciseModel(
            plan_day_id=day.id,
            exercise_id=exercise.id,
            order_number=1,
            target_sets=3,
            target_reps="10",
            target_weight=185.0,
            has_reps=True,
            has_weight=True,
            has_duration=False,
        )
        postgres_db.add(workout_exercise)
        postgres_db.commit()

        exercise_id = exercise.id

        # Delete the plan
        postgres_db.delete(plan)
        postgres_db.commit()

        # Exercise should still exist
        remaining_exercise = postgres_db.query(ExerciseModel).filter(ExerciseModel.id == exercise_id).first()
        assert remaining_exercise is not None
        assert remaining_exercise.name == "Bench Press"
