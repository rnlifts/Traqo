"""Regression tests for the plan-name length/word limits (PLAN_NAME_MAX_LENGTH
/ PLAN_NAME_MAX_WORDS in schemas.py). Plan names (e.g. "Beginner Plan",
"Weight Loss Plan") are meant to be a short title -- without a limit, a
pasted paragraph could be saved as a plan name, e.g. via a scripted request
bypassing the frontend's own input guard.

Covers all three endpoints that accept a plan name: POST /workout-plans
(create), PUT /workout-plans/{id} (rename), and POST /workout-plans/build
(the initial "Create Plan" flow and plan duplication both funnel through
this one).
"""

import pytest
from starlette.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database import Base, get_db
from src.app import app
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    db_file = tmp_path / "test_plan_name_limits.db"
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
    return sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="function")
def client(test_engine, test_session_factory):
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
def user_with_plan(test_session_factory):
    session = test_session_factory()
    owner = UserModel(id=1, username="owner", display_name="Owner", password_hash="hash")
    session.add(owner)
    session.commit()

    plan = WorkoutPlanModel(id=1, user_id=owner.id, name="Existing Plan")
    session.add(plan)
    session.commit()

    result = {"user_id": owner.id, "plan_id": plan.id}
    session.close()
    return result


@pytest.fixture
def auth_headers():
    from src.infrastructure.security.jwt_service import create_access_token

    return {"Authorization": f"Bearer {create_access_token(1)}"}


LONG_NO_SPACE_NAME = "s" * 61
TOO_MANY_WORDS_NAME = "one two three four five six seven eight nine"
VALID_NAME = "12 Week Beginner Full Body Plan"


class TestCreateWorkoutPlanNameLimits:
    def test_rejects_a_name_over_the_character_limit(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans", json={"name": LONG_NO_SPACE_NAME}, headers=auth_headers)
        assert response.status_code == 422

    def test_rejects_a_name_with_more_than_eight_words(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans", json={"name": TOO_MANY_WORDS_NAME}, headers=auth_headers)
        assert response.status_code == 422

    def test_accepts_a_name_within_the_limits(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans", json={"name": VALID_NAME}, headers=auth_headers)
        assert response.status_code == 201, response.text
        assert response.json()["name"] == VALID_NAME


class TestUpdateWorkoutPlanNameLimits:
    def test_rejects_a_name_over_the_character_limit(self, client, user_with_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{user_with_plan['plan_id']}",
            json={"name": LONG_NO_SPACE_NAME},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_rejects_a_name_with_more_than_eight_words(self, client, user_with_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{user_with_plan['plan_id']}",
            json={"name": TOO_MANY_WORDS_NAME},
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestBuildPlanNameLimits:
    """Covers the /build endpoint's name field, since both the initial
    "Create Plan" save and "duplicate plan" funnel through it."""

    def _payload(self, name):
        return {
            "name": name,
            "unit_type": "days",
            "total_units": 1,
            "days": [{"label": "Day 1", "is_rest": False, "order_position": 1, "exercises": []}],
        }

    def test_rejects_a_name_over_the_character_limit(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans/build", json=self._payload(LONG_NO_SPACE_NAME), headers=auth_headers)
        assert response.status_code == 422

    def test_rejects_a_name_with_more_than_eight_words(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans/build", json=self._payload(TOO_MANY_WORDS_NAME), headers=auth_headers)
        assert response.status_code == 422

    def test_accepts_a_name_within_the_limits(self, client, user_with_plan, auth_headers):
        response = client.post("/api/workout-plans/build", json=self._payload(VALID_NAME), headers=auth_headers)
        assert response.status_code == 201, response.text
