"""Integration tests for workout plan routes.

Tests the API endpoints for workout plans, focusing on the new target_sets,
target_reps, and target_weight fields.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from src.app import app
from src.infrastructure.database import Base, get_db
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.auth.infrastructure.models.user_model import UserModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    # Use a file-based SQLite database for proper connection sharing
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create all tables
    Base.metadata.create_all(engine)

    yield engine

    engine.dispose()


@pytest.fixture
def test_session_factory(test_engine):
    """Create a session factory from the test engine."""
    return sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture
def client(test_engine, test_session_factory):
    """Provide a TestClient with dependency override for the test database."""
    def override_get_db():
        db = test_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(test_session_factory):
    """Create and return a test user."""
    session = test_session_factory()

    user = UserModel(
        id=1,
        username="testuser",
        display_name="Test User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "testuser"}


@pytest.fixture
def test_exercise(test_session_factory, test_user):
    """Create and return a test exercise."""
    session = test_session_factory()

    exercise = ExerciseModel(
        user_id=test_user["id"],
        name="Bench Press",
    )
    session.add(exercise)
    session.commit()
    ex_id = exercise.id
    session.close()
    return {"id": ex_id, "name": "Bench Press"}


@pytest.fixture
def test_plan(test_session_factory, test_user):
    """Create and return a test workout plan."""
    session = test_session_factory()

    plan = WorkoutPlanModel(
        user_id=test_user["id"],
        name="Test Plan",
    )
    session.add(plan)
    session.commit()
    plan_id = plan.id
    session.close()
    return {"id": plan_id, "name": "Test Plan"}


# Patch the dependency to return the test user ID
@pytest.fixture
def client_with_auth(client, test_user):
    """Provide a TestClient with mocked authentication."""
    from src.infrastructure.security.oauth2 import get_current_user_id

    # Store user_id before creating the closure
    user_id = test_user["id"]

    def override_get_current_user_id():
        return user_id

    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    yield client
    app.dependency_overrides.clear()


class TestAddExerciseToPlanAPI:
    """Test POST /api/workout-plans/{plan_id}/exercises endpoint."""

    def test_add_exercise_with_all_target_fields(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test adding exercise with all target fields returns 201 with correct data."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_sets": 4,
                "target_reps": 8,
                "target_weight": 225.0,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["exercise_id"] == test_exercise["id"]
        assert data["workout_plan_id"] == test_plan["id"]
        assert data["order_number"] == 1
        assert data["target_sets"] == 4
        assert data["target_reps"] == 8
        assert data["target_weight"] == 225.0

    def test_add_exercise_without_target_fields(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test adding exercise without target fields returns nulls."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["exercise_id"] == test_exercise["id"]
        assert data["target_sets"] is None
        assert data["target_reps"] is None
        assert data["target_weight"] is None

    def test_add_exercise_with_partial_target_fields(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test adding exercise with only some target fields."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_sets": 3,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["target_sets"] == 3
        assert data["target_reps"] is None
        assert data["target_weight"] is None

    def test_add_exercise_with_zero_target_weight(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test that zero target_weight is accepted."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_weight": 0.0,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["target_weight"] == 0.0

    def test_add_exercise_target_sets_zero_fails_validation(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test that target_sets: 0 fails validation (gt=0)."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_sets": 0,
            },
        )

        assert response.status_code == 422

    def test_add_exercise_target_sets_negative_fails_validation(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test that negative target_sets fails validation."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_sets": -1,
            },
        )

        assert response.status_code == 422

    def test_add_exercise_target_reps_zero_fails_validation(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test that target_reps: 0 fails validation (gt=0)."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_reps": 0,
            },
        )

        assert response.status_code == 422

    def test_add_exercise_target_weight_negative_fails_validation(
        self, client_with_auth, test_plan, test_exercise
    ):
        """Test that negative target_weight fails validation (ge=0)."""
        response = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={
                "exercise_id": test_exercise["id"],
                "target_weight": -10.5,
            },
        )

        assert response.status_code == 422

    def test_add_multiple_exercises_to_plan_increments_order(
        self, client_with_auth, test_session_factory, test_plan, test_user
    ):
        """Test that order_number increments correctly for multiple exercises."""
        session = test_session_factory()

        # Create two exercises
        ex1 = ExerciseModel(user_id=test_user["id"], name="Bench Press")
        ex2 = ExerciseModel(user_id=test_user["id"], name="Squat")
        session.add(ex1)
        session.add(ex2)
        session.commit()
        ex1_id = ex1.id
        ex2_id = ex2.id
        session.close()

        # Add first exercise
        response1 = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={"exercise_id": ex1_id},
        )
        assert response1.status_code == 201
        assert response1.json()["order_number"] == 1

        # Add second exercise
        response2 = client_with_auth.post(
            f"/api/workout-plans/{test_plan['id']}/exercises",
            json={"exercise_id": ex2_id},
        )
        assert response2.status_code == 201
        assert response2.json()["order_number"] == 2


class TestGetWorkoutPlanDetailAPI:
    """Test GET /api/workout-plans/{plan_id} endpoint."""

    def test_get_plan_detail_includes_target_fields(
        self, client_with_auth, test_session_factory, test_plan, test_user
    ):
        """Test that GET plan detail returns target fields in exercises."""
        session = test_session_factory()

        # Create exercises with and without target fields
        ex1 = ExerciseModel(user_id=test_user["id"], name="Ex1")
        ex2 = ExerciseModel(user_id=test_user["id"], name="Ex2")
        session.add(ex1)
        session.add(ex2)
        session.commit()
        ex1_id = ex1.id
        ex2_id = ex2.id

        # Add first exercise with targets
        we1 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex1_id,
            order_number=1,
            target_sets=4,
            target_reps=8,
            target_weight=225.0,
        )
        # Add second exercise without targets
        we2 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex2_id,
            order_number=2,
            target_sets=None,
            target_reps=None,
            target_weight=None,
        )
        session.add(we1)
        session.add(we2)
        session.commit()
        session.close()

        response = client_with_auth.get(f"/api/workout-plans/{test_plan['id']}")

        assert response.status_code == 200
        data = response.json()
        exercises = data["exercises"]
        assert len(exercises) == 2

        # First exercise should have targets
        assert exercises[0]["order_number"] == 1
        assert exercises[0]["target_sets"] == 4
        assert exercises[0]["target_reps"] == 8
        assert exercises[0]["target_weight"] == 225.0

        # Second exercise should have nulls
        assert exercises[1]["order_number"] == 2
        assert exercises[1]["target_sets"] is None
        assert exercises[1]["target_reps"] is None
        assert exercises[1]["target_weight"] is None

    def test_get_plan_detail_empty_exercises(self, client_with_auth, test_plan):
        """Test GET plan detail with no exercises."""
        response = client_with_auth.get(f"/api/workout-plans/{test_plan['id']}")

        assert response.status_code == 200
        data = response.json()
        assert data["exercises"] == []


class TestReorderExerciseAPI:
    """Test PUT /api/workout-plans/{plan_id}/exercises/{exercise_id}/move endpoint."""

    def test_reorder_exercise_preserves_target_fields(
        self, client_with_auth, test_session_factory, test_plan, test_user
    ):
        """Test that reordering preserves target field values."""
        session = test_session_factory()

        # Create two exercises
        ex1 = ExerciseModel(user_id=test_user["id"], name="Ex1")
        ex2 = ExerciseModel(user_id=test_user["id"], name="Ex2")
        session.add(ex1)
        session.add(ex2)
        session.commit()
        ex1_id = ex1.id
        ex2_id = ex2.id

        # Add first exercise with targets
        we1 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex1_id,
            order_number=1,
            target_sets=3,
            target_reps=10,
            target_weight=185.0,
        )
        # Add second exercise without targets
        we2 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex2_id,
            order_number=2,
        )
        session.add(we1)
        session.add(we2)
        session.commit()
        session.close()

        # Reorder first exercise down
        response = client_with_auth.put(
            f"/api/workout-plans/{test_plan['id']}/exercises/{ex1_id}/move",
            json={"direction": "down"},
        )

        assert response.status_code == 200
        data = response.json()
        # Targets should still be there
        assert data["target_sets"] == 3
        assert data["target_reps"] == 10
        assert data["target_weight"] == 185.0
        # Order should have changed
        assert data["order_number"] == 2

    def test_reorder_exercise_no_targets_returns_nulls(
        self, client_with_auth, test_session_factory, test_plan, test_user
    ):
        """Test that reordering exercises without targets returns nulls."""
        session = test_session_factory()

        # Create two exercises
        ex1 = ExerciseModel(user_id=test_user["id"], name="Ex1")
        ex2 = ExerciseModel(user_id=test_user["id"], name="Ex2")
        session.add(ex1)
        session.add(ex2)
        session.commit()
        ex1_id = ex1.id
        ex2_id = ex2.id

        # Add exercises without targets
        we1 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex1_id,
            order_number=1,
        )
        we2 = WorkoutExerciseModel(
            workout_plan_id=test_plan["id"],
            exercise_id=ex2_id,
            order_number=2,
        )
        session.add(we1)
        session.add(we2)
        session.commit()
        session.close()

        # Reorder first exercise
        response = client_with_auth.put(
            f"/api/workout-plans/{test_plan['id']}/exercises/{ex1_id}/move",
            json={"direction": "down"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["target_sets"] is None
        assert data["target_reps"] is None
        assert data["target_weight"] is None
