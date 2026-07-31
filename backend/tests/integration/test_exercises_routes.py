"""Integration tests for exercises routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from src.app import app
from src.infrastructure.database import Base, get_db
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.auth.infrastructure.models.user_model import UserModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_exercises.db"
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

    # Create a JWT token directly for the test user to avoid rate limiter conflicts
    token = create_access_token(test_user["id"])
    return {"Authorization": f"Bearer {token}"}


class TestExercisesRoutes:
    """Tests for exercises HTTP routes."""

    def test_list_exercises_empty(self, client, auth_headers):
        """GET /api/exercises with no exercises returns 200 with empty list."""
        response = client.get("/api/exercises", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_exercises_custom_only_empty(self, client, auth_headers):
        """GET /api/exercises?custom_only=true with no exercises returns 200 with empty list."""
        response = client.get("/api/exercises?custom_only=true", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_exercise_defaults_is_custom_to_true(self, client, auth_headers):
        """POST /api/exercises without is_custom defaults to True."""
        response = client.post(
            "/api/exercises",
            json={"name": "Bench Press"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Bench Press"
        assert data["is_custom"] is True

    def test_create_exercise_with_is_custom_false(self, client, auth_headers):
        """POST /api/exercises with is_custom=False respects the parameter."""
        response = client.post(
            "/api/exercises",
            json={"name": "Library Exercise", "is_custom": False},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Library Exercise"
        assert data["is_custom"] is False

    def test_list_exercises_returns_all_custom_and_non_custom(self, client, auth_headers, test_session_factory):
        """GET /api/exercises returns both custom and non-custom exercises."""
        # Create test user and exercises
        session = test_session_factory()
        custom_ex = ExerciseModel(
            user_id=1,
            name="Custom Bench Press",
            is_custom=True,
        )
        non_custom_ex = ExerciseModel(
            user_id=1,
            name="Library Deadlift",
            is_custom=False,
        )
        session.add(custom_ex)
        session.add(non_custom_ex)
        session.commit()
        session.close()

        # List all exercises
        response = client.get("/api/exercises", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = {e["name"] for e in data}
        assert names == {"Custom Bench Press", "Library Deadlift"}

    def test_list_exercises_custom_only_returns_only_custom(self, client, auth_headers, test_session_factory):
        """GET /api/exercises?custom_only=true returns only is_custom=True exercises."""
        # Create test exercises
        session = test_session_factory()
        custom_ex = ExerciseModel(
            user_id=1,
            name="Custom Bench Press",
            is_custom=True,
        )
        non_custom_ex = ExerciseModel(
            user_id=1,
            name="Library Deadlift",
            is_custom=False,
        )
        session.add(custom_ex)
        session.add(non_custom_ex)
        session.commit()
        session.close()

        # List only custom exercises
        response = client.get("/api/exercises?custom_only=true", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Custom Bench Press"
        assert data[0]["is_custom"] is True

    def test_list_exercises_custom_only_excludes_non_custom(self, client, auth_headers, test_session_factory):
        """GET /api/exercises?custom_only=true excludes is_custom=False exercises."""
        # Create test exercises
        session = test_session_factory()
        ex1 = ExerciseModel(user_id=1, name="Custom 1", is_custom=True)
        ex2 = ExerciseModel(user_id=1, name="Non-Custom 1", is_custom=False)
        ex3 = ExerciseModel(user_id=1, name="Custom 2", is_custom=True)
        session.add(ex1)
        session.add(ex2)
        session.add(ex3)
        session.commit()
        session.close()

        # List only custom exercises
        response = client.get("/api/exercises?custom_only=true", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = {e["name"] for e in data}
        assert names == {"Custom 1", "Custom 2"}
        assert all(e["is_custom"] for e in data)

    def test_update_exercise_happy_path(self, client, auth_headers, test_session_factory):
        """PUT /api/exercises/{id} updates an exercise's fields."""
        # Create an exercise
        session = test_session_factory()
        exercise = ExerciseModel(
            user_id=1,
            name="Original Name",
            muscle_group="chest",
            equipment=None,
            video_url=None,
            is_custom=True,
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id
        session.close()

        # Update it
        response = client.put(
            f"/api/exercises/{exercise_id}",
            json={
                "name": "Updated Name",
                "muscle_group": "back",
                "equipment": "barbell",
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == exercise_id
        assert data["name"] == "Updated Name"
        assert data["muscle_group"] == "back"
        assert data["equipment"] == "barbell"
        assert data["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        # Verify is_custom is preserved
        assert data["is_custom"] is True

    def test_update_exercise_partial_fields(self, client, auth_headers, test_session_factory):
        """PUT /api/exercises/{id} updates only provided fields."""
        # Create an exercise
        session = test_session_factory()
        exercise = ExerciseModel(
            user_id=1,
            name="Original Name",
            muscle_group="chest",
            equipment="dumbbell",
            video_url=None,
            is_custom=True,
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id
        session.close()

        # Update only name and video_url
        response = client.put(
            f"/api/exercises/{exercise_id}",
            json={
                "name": "Updated Name",
                "video_url": "https://youtu.be/dQw4w9WgXcQ",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["muscle_group"] == "chest"  # Unchanged
        assert data["equipment"] == "dumbbell"  # Unchanged
        assert data["video_url"] == "https://youtu.be/dQw4w9WgXcQ"
        assert data["is_custom"] is True

    def test_update_nonexistent_exercise_returns_404(self, client, auth_headers):
        """PUT /api/exercises/999 returns 404 when exercise doesn't exist."""
        response = client.put(
            "/api/exercises/999",
            json={"name": "Updated"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_others_exercise_returns_403(self, client, auth_headers, test_session_factory):
        """PUT /api/exercises/{id} returns 403 when updating another user's exercise."""
        # Create an exercise owned by user 2
        session = test_session_factory()
        user2 = UserModel(
            username="otheruser",
            display_name="Other User",
            password_hash="fake_hash",
        )
        session.add(user2)
        session.commit()

        exercise = ExerciseModel(
            user_id=user2.id,
            name="Other User's Exercise",
            is_custom=True,
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id
        session.close()

        # Try to update as user 1 (auth_headers is for user 1)
        response = client.put(
            f"/api/exercises/{exercise_id}",
            json={"name": "Updated"},
            headers=auth_headers,
        )
        assert response.status_code == 403

    def test_delete_custom_exercise(self, client, auth_headers, test_session_factory):
        """DELETE /api/exercises/{id} deletes a custom exercise."""
        # Create an exercise
        session = test_session_factory()
        exercise = ExerciseModel(
            user_id=1,
            name="Exercise to Delete",
            is_custom=True,
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id
        session.close()

        # Delete it
        response = client.delete(
            f"/api/exercises/{exercise_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify it's gone
        response = client.get("/api/exercises", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    def test_create_exercise_with_all_metadata(self, client, auth_headers):
        """POST /api/exercises with all metadata fields."""
        response = client.post(
            "/api/exercises",
            json={
                "name": "Bench Press",
                "muscle_group": "chest",
                "equipment": "barbell",
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "is_custom": True,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Bench Press"
        assert data["muscle_group"] == "chest"
        assert data["equipment"] == "barbell"
        assert data["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert data["is_custom"] is True

    def test_create_exercise_invalid_youtube_url(self, client, auth_headers):
        """POST /api/exercises with invalid YouTube URL returns 422."""
        response = client.post(
            "/api/exercises",
            json={
                "name": "Bench Press",
                "video_url": "https://vimeo.com/123456",  # Not YouTube
            },
            headers=auth_headers,
        )
        assert response.status_code == 422  # Validation error

    def test_update_exercise_valid_youtu_be_url(self, client, auth_headers, test_session_factory):
        """PUT /api/exercises/{id} accepts youtu.be URLs."""
        # Create an exercise
        session = test_session_factory()
        exercise = ExerciseModel(
            user_id=1,
            name="Original",
            is_custom=True,
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id
        session.close()

        # Update with youtu.be URL
        response = client.put(
            f"/api/exercises/{exercise_id}",
            json={
                "name": "Updated",
                "video_url": "https://youtu.be/dQw4w9WgXcQ",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["video_url"] == "https://youtu.be/dQw4w9WgXcQ"
