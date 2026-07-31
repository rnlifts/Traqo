"""Integration tests for exercise library routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from src.app import app
from src.infrastructure.database import Base, get_db
from src.modules.exercise_library.infrastructure.models.exercise_library_item_model import ExerciseLibraryItemModel
from src.modules.auth.infrastructure.models.user_model import UserModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_exercise_library.db"
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


class TestExerciseLibraryRoutes:
    """Tests for exercise library HTTP routes."""

    def test_search_empty_library(self, client, auth_headers):
        """GET /exercise-library with empty library returns 200 with empty list."""
        response = client.get("/api/exercise-library", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_muscle_groups_empty_library(self, client, auth_headers):
        """GET /exercise-library/muscle-groups with empty library returns 200 with empty list."""
        response = client.get(
            "/api/exercise-library/muscle-groups",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data == {"muscle_groups": []}

    def test_search_with_query_parameter(self, client, auth_headers, test_session_factory):
        """GET /exercise-library?q=query returns matching exercises."""
        # Insert a library item directly into database
        session = test_session_factory()
        item = ExerciseLibraryItemModel(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        session.add(item)
        session.commit()
        session.close()

        # Search for it
        response = client.get(
            "/api/exercise-library?q=bench",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Bench Press"
        assert data[0]["muscle_group"] == "Chest"

    def test_search_with_muscle_group_filter(self, client, auth_headers, test_session_factory):
        """GET /exercise-library?muscle_group=Chest returns only Chest exercises."""
        # Insert two items with different muscle groups
        session = test_session_factory()
        chest_item = ExerciseLibraryItemModel(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        back_item = ExerciseLibraryItemModel(
            name="Deadlift",
            muscle_group="Back",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        session.add(chest_item)
        session.add(back_item)
        session.commit()
        session.close()

        # Filter by Chest
        response = client.get(
            "/api/exercise-library?muscle_group=Chest",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Bench Press"
        assert data[0]["muscle_group"] == "Chest"

    def test_get_distinct_muscle_groups(self, client, auth_headers, test_session_factory):
        """GET /exercise-library/muscle-groups returns sorted distinct groups."""
        # Insert multiple items
        session = test_session_factory()
        items = [
            ExerciseLibraryItemModel(name="Bench Press", muscle_group="Chest", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItemModel(name="Incline Press", muscle_group="Chest", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItemModel(name="Deadlift", muscle_group="Back", equipment="Barbell", video_url=None, image_url=None),
        ]
        for item in items:
            session.add(item)
        session.commit()
        session.close()

        # Get muscle groups
        response = client.get(
            "/api/exercise-library/muscle-groups",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["muscle_groups"] == ["Back", "Chest"]  # Sorted

    def test_search_includes_video_url_field(self, client, auth_headers, test_session_factory):
        """Search results include video_url field for exercises with YouTube links."""
        session = test_session_factory()
        item = ExerciseLibraryItemModel(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            image_url=None,
        )
        session.add(item)
        session.commit()
        session.close()

        response = client.get(
            "/api/exercise-library",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "video_url" in data[0]
        assert data[0]["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_search_video_url_null_when_not_set(self, client, auth_headers, test_session_factory):
        """Search results have video_url=null when exercise has no video URL."""
        session = test_session_factory()
        item = ExerciseLibraryItemModel(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        session.add(item)
        session.commit()
        session.close()

        response = client.get(
            "/api/exercise-library",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "video_url" in data[0]
        assert data[0]["video_url"] is None
