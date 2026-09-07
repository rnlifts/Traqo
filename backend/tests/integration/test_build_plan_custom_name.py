"""Regression tests for custom_name support in the bulk plan-build endpoint
(POST /api/workout-plans/build), used both for the initial "Create Plan"
flow and for plan duplication. Confirms the optional day nickname
(e.g. "Chest Day") round-trips through this endpoint for both days-type and
weeks-type plans, alongside the existing, unmodified "label" field.

No test previously existed for this endpoint at all -- this file also
serves as the first coverage for POST /workout-plans/build generally,
scoped to what this task actually touched (custom_name), not an attempt
to backfill full coverage for the whole endpoint.
"""

import pytest
from starlette.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database import Base, get_db
from src.app import app
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    db_file = tmp_path / "test_build_plan_custom_name.db"
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
def user_with_exercise(test_session_factory):
    session = test_session_factory()
    owner = UserModel(id=1, username="owner", display_name="Owner", password_hash="hash")
    session.add(owner)
    session.commit()

    exercise = ExerciseModel(id=1, user_id=owner.id, name="Bench Press", muscle_group="chest", equipment="barbell")
    session.add(exercise)
    session.commit()

    result = {"user_id": owner.id, "exercise_id": exercise.id}
    session.close()
    return result


@pytest.fixture
def auth_headers():
    from src.infrastructure.security.jwt_service import create_access_token

    return {"Authorization": f"Bearer {create_access_token(1)}"}


class TestBuildPlanCustomName:
    def test_days_type_plan_persists_custom_name_alongside_label(
        self, client, user_with_exercise, auth_headers
    ):
        payload = {
            "name": "PPL Split",
            "unit_type": "days",
            "total_units": 2,
            "days": [
                {
                    "label": "Day 1",
                    "is_rest": False,
                    "order_position": 1,
                    "custom_name": "Chest Day",
                    "exercises": [{"exercise_id": user_with_exercise["exercise_id"], "target_sets": 3}],
                },
                {"label": "Day 2", "is_rest": True, "order_position": 2, "exercises": []},
            ],
        }
        response = client.post("/api/workout-plans/build", json=payload, headers=auth_headers)
        assert response.status_code == 201, response.text

        days = response.json()["days"]
        assert days[0]["label"] == "Day 1"
        assert days[0]["custom_name"] == "Chest Day"
        # Day 2 never had one set -- must not have silently picked one up.
        assert days[1]["custom_name"] is None

    def test_days_type_plan_without_custom_name_still_works(
        self, client, user_with_exercise, auth_headers
    ):
        """Regression check: omitting custom_name entirely (the pre-existing
        request shape) must keep working exactly as before."""
        payload = {
            "name": "Plain Plan",
            "unit_type": "days",
            "total_units": 1,
            "days": [{"label": "Day 1", "is_rest": False, "order_position": 1, "exercises": []}],
        }
        response = client.post("/api/workout-plans/build", json=payload, headers=auth_headers)
        assert response.status_code == 201, response.text
        assert response.json()["days"][0]["custom_name"] is None

    def test_weeks_type_plan_persists_custom_name_on_a_base_week_day(
        self, client, user_with_exercise, auth_headers
    ):
        payload = {
            "name": "4-Week Block",
            "unit_type": "weeks",
            "total_units": 1,
            "weeks": [
                {
                    "week_number": 1,
                    "mode": "base",
                    "days": [
                        {
                            "label": "Day 1",
                            "is_rest": False,
                            "order_position": 1,
                            "custom_name": "Pull Day",
                            "exercises": [],
                        }
                    ],
                }
            ],
        }
        response = client.post("/api/workout-plans/build", json=payload, headers=auth_headers)
        assert response.status_code == 201, response.text

        week = response.json()["weeks"][0]
        assert week["days"][0]["custom_name"] == "Pull Day"

    def test_duplicating_a_plan_via_build_preserves_custom_name(
        self, client, user_with_exercise, auth_headers
    ):
        """The frontend's "duplicate plan" feature re-POSTs an existing plan's
        detail (fetched via GET) straight back to this same /build endpoint.
        Confirms that round trip doesn't drop the nickname along the way."""
        create_payload = {
            "name": "Original Plan",
            "unit_type": "days",
            "total_units": 1,
            "days": [
                {
                    "label": "Day 1",
                    "is_rest": False,
                    "order_position": 1,
                    "custom_name": "Leg Day",
                    "exercises": [],
                }
            ],
        }
        created = client.post("/api/workout-plans/build", json=create_payload, headers=auth_headers).json()

        duplicate_payload = {
            "name": "Original Plan (Copy)",
            "unit_type": "days",
            "total_units": 1,
            "days": [
                {
                    "label": d["label"],
                    "is_rest": d["is_rest"],
                    "order_position": i + 1,
                    "custom_name": d["custom_name"],
                    "exercises": [],
                }
                for i, d in enumerate(created["days"])
            ],
        }
        duplicated = client.post("/api/workout-plans/build", json=duplicate_payload, headers=auth_headers).json()

        assert duplicated["days"][0]["custom_name"] == "Leg Day"
