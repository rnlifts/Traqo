"""Integration tests for workout plan routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from src.app import app
from src.infrastructure.database import Base, get_db
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_workouts.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
def auth_headers(test_session_factory, test_user):
    """Create auth headers for test user without using rate-limited login."""
    from src.infrastructure.security.jwt_service import create_access_token

    token = create_access_token(test_user["id"])
    return {"Authorization": f"Bearer {token}"}


class TestWorkoutExerciseVideoUrl:
    """Tests for video_url field in workout exercise responses."""

    def test_workout_plan_detail_includes_video_url(self, client, auth_headers, test_session_factory):
        """GET /api/workout-plans/{id} includes video_url in exercise details."""
        session = test_session_factory()

        # Create user, plan, day, exercise, and workout exercise with video_url
        plan = WorkoutPlanModel(id=1, user_id=1, name="Test Plan")
        session.add(plan)
        session.flush()  # Ensure plan is persisted before referencing it

        day = PlanDayModel(id=1, workout_plan_id=1, label="Day 1", order_position=1, is_rest=False)
        session.add(day)

        exercise = ExerciseModel(
            id=1,
            user_id=1,
            name="Bench Press",
            muscle_group="chest",
            logging_type="weight_reps",
            equipment="barbell",
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            is_custom=False,
        )
        session.add(exercise)

        workout_exercise = WorkoutExerciseModel(
            id=1,
            plan_day_id=1,
            exercise_id=1,
            order_number=1,
            target_sets=3,
            target_reps="10",
            target_weight=185.0,
            target_duration_seconds=None,
            notes="",
            has_reps=True,
            has_weight=True,
            has_duration=False,
        )
        session.add(workout_exercise)

        session.commit()
        session.close()

        # Fetch plan detail
        response = client.get("/api/workout-plans/1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Verify video_url, muscle_group, and equipment are present in the exercise
        assert "days" in data
        assert len(data["days"]) == 1
        assert "exercises" in data["days"][0]
        assert len(data["days"][0]["exercises"]) == 1
        exercise_detail = data["days"][0]["exercises"][0]
        assert "video_url" in exercise_detail
        assert exercise_detail["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert "muscle_group" in exercise_detail
        assert exercise_detail["muscle_group"] == "chest"
        assert "equipment" in exercise_detail
        assert exercise_detail["equipment"] == "barbell"

    def test_workout_plan_detail_video_url_null_when_not_set(self, client, auth_headers, test_session_factory):
        """GET /api/workout-plans/{id} has video_url=null for exercises without video."""
        session = test_session_factory()

        # Create plan, day, exercise (no video_url), and workout exercise
        plan = WorkoutPlanModel(id=1, user_id=1, name="Test Plan")
        session.add(plan)
        session.flush()  # Ensure plan is persisted before referencing it

        day = PlanDayModel(id=1, workout_plan_id=1, label="Day 1", order_position=1, is_rest=False)
        session.add(day)

        exercise = ExerciseModel(
            id=1,
            user_id=1,
            name="Squats",
            muscle_group="legs",
            logging_type="weight_reps",
            equipment="barbell",
            video_url=None,
            is_custom=False,
        )
        session.add(exercise)

        workout_exercise = WorkoutExerciseModel(
            id=1,
            plan_day_id=1,
            exercise_id=1,
            order_number=1,
            target_sets=3,
            target_reps="10",
            target_weight=225.0,
            target_duration_seconds=None,
            notes="",
            has_reps=True,
            has_weight=True,
            has_duration=False,
        )
        session.add(workout_exercise)

        session.commit()
        session.close()

        # Fetch plan detail
        response = client.get("/api/workout-plans/1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Verify video_url, muscle_group, and equipment are present
        exercise_detail = data["days"][0]["exercises"][0]
        assert "video_url" in exercise_detail
        assert exercise_detail["video_url"] is None
        assert "muscle_group" in exercise_detail
        assert exercise_detail["muscle_group"] == "legs"
        assert "equipment" in exercise_detail
        assert exercise_detail["equipment"] == "barbell"

