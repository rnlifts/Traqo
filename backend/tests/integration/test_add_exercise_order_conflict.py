"""Regression test for Task 94: adding an exercise to a day after deleting a
non-last exercise from that day used to throw an unhandled 500 (Postgres/SQLite
UNIQUE(plan_day_id, order_number) violation), because the next order_number was
computed from a count of remaining exercises rather than the highest surviving one.

Uses a real SQLite DB (via SQLAlchemy models, same UniqueConstraint declared on
WorkoutExerciseModel as production's Postgres schema) so the UNIQUE violation this
bug depends on is actually enforced, not just asserted in application logic.
"""

import pytest
from starlette.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database import Base, get_db
from src.app import app
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    db_file = tmp_path / "test_add_exercise_order_conflict.db"
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
def plan_with_four_exercises(test_session_factory):
    """A plan day with 4 exercises at order_number 1, 2, 3, 4, plus a 5th exercise
    (not yet in any day) ready to be added by the tests below."""
    session = test_session_factory()

    owner = UserModel(id=1, username="owner", display_name="Owner", password_hash="hash")
    session.add(owner)
    session.commit()

    exercises = [
        ExerciseModel(id=i, user_id=owner.id, name=f"Exercise {i}", muscle_group="chest", equipment="none")
        for i in range(1, 6)
    ]
    session.add_all(exercises)
    session.commit()

    plan = WorkoutPlanModel(id=1, user_id=owner.id, name="Test Plan", unit_type="days", total_units=1)
    session.add(plan)
    session.commit()

    day = PlanDayModel(id=1, workout_plan_id=plan.id, label="Day 1", order_position=1)
    session.add(day)
    session.commit()

    workout_exercises = [
        WorkoutExerciseModel(id=i, plan_day_id=day.id, exercise_id=i, order_number=i)
        for i in range(1, 5)
    ]
    session.add_all(workout_exercises)
    session.commit()

    result = {
        "owner_id": owner.id,
        "plan_id": plan.id,
        "day_id": day.id,
        # workout_exercise ids 1-4 map to order_number 1-4 respectively
        "workout_exercise_ids": [1, 2, 3, 4],
        "unused_exercise_id": 5,
    }
    session.close()
    return result


@pytest.fixture
def auth_headers():
    from src.infrastructure.security.jwt_service import create_access_token

    return {"owner": {"Authorization": f"Bearer {create_access_token(1)}"}}


class TestAddExerciseAfterDeletingNonLast:
    def test_add_after_deleting_middle_exercise_succeeds(
        self, client, plan_with_four_exercises, auth_headers
    ):
        """Delete order_number 2 (leaving a gap: 1, 3, 4), then add a new exercise.
        Before the fix, this raised an unhandled IntegrityError -> 500."""
        plan_id = plan_with_four_exercises["plan_id"]
        day_id = plan_with_four_exercises["day_id"]
        we_id_at_order_2 = plan_with_four_exercises["workout_exercise_ids"][1]

        delete_response = client.delete(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises/{we_id_at_order_2}",
            headers=auth_headers["owner"],
        )
        assert delete_response.status_code == 204

        add_response = client.post(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises",
            json={"exercise_id": plan_with_four_exercises["unused_exercise_id"]},
            headers=auth_headers["owner"],
        )
        assert add_response.status_code == 201, add_response.text
        assert add_response.json()["order_number"] == 5

    def test_add_after_deleting_first_exercise_succeeds(
        self, client, plan_with_four_exercises, auth_headers
    ):
        """Same bug class from the other end: delete order_number 1 (leaving 2, 3, 4)."""
        plan_id = plan_with_four_exercises["plan_id"]
        day_id = plan_with_four_exercises["day_id"]
        we_id_at_order_1 = plan_with_four_exercises["workout_exercise_ids"][0]

        delete_response = client.delete(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises/{we_id_at_order_1}",
            headers=auth_headers["owner"],
        )
        assert delete_response.status_code == 204

        add_response = client.post(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises",
            json={"exercise_id": plan_with_four_exercises["unused_exercise_id"]},
            headers=auth_headers["owner"],
        )
        assert add_response.status_code == 201, add_response.text
        assert add_response.json()["order_number"] == 5

    def test_no_duplicate_order_numbers_after_add(self, client, plan_with_four_exercises, auth_headers):
        """Belt-and-suspenders: confirm the resulting day never has two exercises
        sharing an order_number, regardless of which one was deleted."""
        plan_id = plan_with_four_exercises["plan_id"]
        day_id = plan_with_four_exercises["day_id"]
        we_id_at_order_3 = plan_with_four_exercises["workout_exercise_ids"][2]

        client.delete(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises/{we_id_at_order_3}",
            headers=auth_headers["owner"],
        )
        client.post(
            f"/api/workout-plans/{plan_id}/days/{day_id}/exercises",
            json={"exercise_id": plan_with_four_exercises["unused_exercise_id"]},
            headers=auth_headers["owner"],
        )

        plan_detail = client.get(f"/api/workout-plans/{plan_id}", headers=auth_headers["owner"]).json()
        day = next(d for d in plan_detail["days"] if d["id"] == day_id)
        order_numbers = [we["order_number"] for we in day["exercises"]]
        assert len(order_numbers) == len(set(order_numbers)), f"Duplicate order_numbers: {order_numbers}"
