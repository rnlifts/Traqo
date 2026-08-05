"""Tests for plan editing via share grants (Task 93).

Full coverage across all 10 plan-builder endpoints that accept edit-tier share
authorization: for each, an owner, an edit-tier grantee, a view-tier grantee, and a
stranger are all exercised, confirming the owner and edit-tier grantee succeed while
the view-tier grantee and the stranger are both rejected with 403. This is a
deliberately thorough suite (see task_specs/task_93_...): a mistake in this
authorization logic would grant unauthorized write access, not just incorrectly block
a legitimate user, so sampling is not acceptable here.
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
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sharing.infrastructure.models.plan_share_model import PlanShareModel, PlanShareGrantModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_plan_edit_share.db"
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
    """Create a session factory."""
    return sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="function")
def client(test_engine, test_session_factory):
    """TestClient with database override."""
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
def test_users_and_plan(test_session_factory):
    """Create users and a shared plan."""
    session = test_session_factory()

    # Create users
    owner = UserModel(id=1, username="owner", display_name="Owner", password_hash="hash")
    edit_grantee = UserModel(id=2, username="edit_user", display_name="Edit User", password_hash="hash")
    view_grantee = UserModel(id=3, username="view_user", display_name="View User", password_hash="hash")
    stranger = UserModel(id=4, username="stranger", display_name="Stranger", password_hash="hash")

    session.add_all([owner, edit_grantee, view_grantee, stranger])
    session.commit()

    # Create exercise owned by owner
    exercise = ExerciseModel(
        id=1,
        user_id=owner.id,
        name="Pushups",
        muscle_group="chest",
        equipment="none",
    )
    session.add(exercise)
    session.commit()

    # A second exercise owned by owner, NOT yet added to any day - used to test
    # AddExerciseToDay (adding an exercise the grantee doesn't personally own).
    second_exercise = ExerciseModel(
        id=2,
        user_id=owner.id,
        name="Squats",
        muscle_group="legs",
        equipment="none",
    )
    session.add(second_exercise)
    session.commit()

    # Create plan owned by owner
    plan = WorkoutPlanModel(
        id=1,
        user_id=owner.id,
        name="Test Plan",
        unit_type="days",
        total_units=1,
    )
    session.add(plan)
    session.commit()

    # Create day in plan
    day = PlanDayModel(
        id=1,
        workout_plan_id=plan.id,
        label="Day 1",
        order_position=1,
    )
    session.add(day)
    session.commit()

    # Create exercise in day
    workout_exercise = WorkoutExerciseModel(
        id=1,
        plan_day_id=day.id,
        exercise_id=exercise.id,
        order_number=1,
        target_sets=3,
        target_reps="8-10",
        target_weight=100.0,
    )
    session.add(workout_exercise)
    session.commit()

    # Create share with grants
    share = PlanShareModel(
        id=1,
        workout_plan_id=plan.id,
        token="test_token",
        mode="restricted",
        link_permission="edit",
    )
    session.add(share)
    session.commit()

    # Add grants
    edit_grant = PlanShareGrantModel(
        id=1, plan_share_id=share.id, user_id=edit_grantee.id, permission="edit"
    )
    view_grant = PlanShareGrantModel(
        id=2, plan_share_id=share.id, user_id=view_grantee.id, permission="view"
    )
    session.add_all([edit_grant, view_grant])
    session.commit()

    # Store IDs before closing session
    result = {
        "owner_id": owner.id,
        "edit_grantee_id": edit_grantee.id,
        "view_grantee_id": view_grantee.id,
        "stranger_id": stranger.id,
        "plan_id": plan.id,
        "day_id": day.id,
        "exercise_id": exercise.id,
        "second_exercise_id": second_exercise.id,
        "workout_exercise_id": workout_exercise.id,
        "share_id": share.id,
    }

    session.close()
    return result


@pytest.fixture
def test_users_and_weeks_plan(test_session_factory):
    """Create users and a shared WEEKS-type plan, for CustomizeWeek/MatchPreviousWeek tests."""
    session = test_session_factory()

    owner = UserModel(id=1, username="owner", display_name="Owner", password_hash="hash")
    edit_grantee = UserModel(id=2, username="edit_user", display_name="Edit User", password_hash="hash")
    view_grantee = UserModel(id=3, username="view_user", display_name="View User", password_hash="hash")
    stranger = UserModel(id=4, username="stranger", display_name="Stranger", password_hash="hash")
    session.add_all([owner, edit_grantee, view_grantee, stranger])
    session.commit()

    plan = WorkoutPlanModel(
        id=1,
        user_id=owner.id,
        name="Weeks Plan",
        unit_type="weeks",
        total_units=2,
    )
    session.add(plan)
    session.commit()

    week1 = PlanWeekModel(id=1, workout_plan_id=plan.id, week_number=1, mode="base")
    week2 = PlanWeekModel(id=2, workout_plan_id=plan.id, week_number=2, mode="linked")
    session.add_all([week1, week2])
    session.commit()

    day = PlanDayModel(
        id=1,
        workout_plan_id=plan.id,
        plan_week_id=week1.id,
        label="W1 Day 1",
        order_position=1,
    )
    session.add(day)
    session.commit()

    share = PlanShareModel(
        id=1,
        workout_plan_id=plan.id,
        token="weeks_test_token",
        mode="restricted",
        link_permission="edit",
    )
    session.add(share)
    session.commit()

    edit_grant = PlanShareGrantModel(
        id=1, plan_share_id=share.id, user_id=edit_grantee.id, permission="edit"
    )
    view_grant = PlanShareGrantModel(
        id=2, plan_share_id=share.id, user_id=view_grantee.id, permission="view"
    )
    session.add_all([edit_grant, view_grant])
    session.commit()

    result = {
        "owner_id": owner.id,
        "edit_grantee_id": edit_grantee.id,
        "view_grantee_id": view_grantee.id,
        "stranger_id": stranger.id,
        "plan_id": plan.id,
        "share_id": share.id,
    }
    session.close()
    return result


@pytest.fixture
def auth_headers():
    """Create JWT auth headers."""
    from src.infrastructure.security.jwt_service import create_access_token

    return {
        "owner": {"Authorization": f"Bearer {create_access_token(1)}"},
        "edit_grantee": {"Authorization": f"Bearer {create_access_token(2)}"},
        "view_grantee": {"Authorization": f"Bearer {create_access_token(3)}"},
        "stranger": {"Authorization": f"Bearer {create_access_token(4)}"},
    }


class TestPlanEditViaShare:
    """Test plan editing through share grants."""

    def test_owner_can_get_plan_detail(self, client, test_users_and_plan, auth_headers):
        """Owner can get plan detail."""
        response = client.get(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            headers=auth_headers["owner"],
        )
        assert response.status_code == 200
        assert response.json()["plan"]["id"] == test_users_and_plan["plan_id"]

    def test_edit_grantee_can_get_plan_detail(self, client, test_users_and_plan, auth_headers):
        """Edit-tier grantee can get plan detail."""
        response = client.get(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200
        assert response.json()["plan"]["id"] == test_users_and_plan["plan_id"]

    def test_view_grantee_rejected_on_plan_detail(self, client, test_users_and_plan, auth_headers):
        """View-tier grantee is rejected when trying to get plan for editing."""
        response = client.get(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_plan_detail(self, client, test_users_and_plan, auth_headers):
        """Stranger is rejected when trying to get plan."""
        response = client.get(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    def test_owner_can_update_plan(self, client, test_users_and_plan, auth_headers):
        """Owner can update plan name."""
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Updated Plan"},
            headers=auth_headers["owner"],
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Plan"

    def test_edit_grantee_can_update_plan(self, client, test_users_and_plan, auth_headers):
        """Edit-tier grantee can update plan name."""
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Updated by Grantee"},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated by Grantee"

    def test_view_grantee_rejected_on_update_plan(self, client, test_users_and_plan, auth_headers):
        """View-tier grantee is rejected when trying to update plan."""
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Invalid"},
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_update_plan(self, client, test_users_and_plan, auth_headers):
        """Stranger is rejected when trying to update plan."""
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Invalid"},
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    def test_owner_can_create_day(self, client, test_users_and_plan, auth_headers):
        """Owner can create a day."""
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days",
            json={"label": "Day 2"},
            headers=auth_headers["owner"],
        )
        assert response.status_code == 201
        assert response.json()["label"] == "Day 2"

    def test_edit_grantee_can_create_day(self, client, test_users_and_plan, auth_headers):
        """Edit-tier grantee can create a day."""
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days",
            json={"label": "Day by Grantee"},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 201
        assert response.json()["label"] == "Day by Grantee"

    def test_view_grantee_rejected_on_create_day(self, client, test_users_and_plan, auth_headers):
        """View-tier grantee is rejected when trying to create day."""
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days",
            json={"label": "Invalid"},
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_create_day(self, client, test_users_and_plan, auth_headers):
        """Stranger is rejected when trying to create day."""
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days",
            json={"label": "Invalid"},
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    # --- UpdateDay: PUT /{plan_id}/days/{day_id} ---

    def test_owner_can_update_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}",
            json={"label": "Renamed by owner"},
            headers=auth_headers["owner"],
        )
        assert response.status_code == 200
        assert response.json()["label"] == "Renamed by owner"

    def test_edit_grantee_can_update_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}",
            json={"label": "Renamed by grantee"},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200
        assert response.json()["label"] == "Renamed by grantee"

    def test_view_grantee_rejected_on_update_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}",
            json={"label": "Invalid"},
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_update_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}",
            json={"label": "Invalid"},
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    # --- AddExerciseToDay: POST /{plan_id}/days/{day_id}/exercises ---
    # This is the exact regression scenario for the second bug found in Task 93's live
    # verification: AddExerciseToDay has its own, separate exercise-ownership check
    # (independent of the plan-ownership check), which must ALSO be bypassed for an
    # edit-tier grantee adding one of the plan owner's own exercises.

    def test_owner_can_add_exercise_to_day(self, client, test_users_and_plan, auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}/exercises",
            json={"exercise_id": test_users_and_plan["second_exercise_id"]},
            headers=auth_headers["owner"],
        )
        assert response.status_code == 201

    def test_edit_grantee_can_add_exercise_to_day(self, client, test_users_and_plan, auth_headers):
        """Regression test: edit-tier grantee adds the plan owner's exercise (not their own)."""
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}/exercises",
            json={"exercise_id": test_users_and_plan["second_exercise_id"]},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.json()}"
        assert response.json()["exercise_id"] == test_users_and_plan["second_exercise_id"]

    def test_view_grantee_rejected_on_add_exercise_to_day(self, client, test_users_and_plan, auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}/exercises",
            json={"exercise_id": test_users_and_plan["second_exercise_id"]},
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_add_exercise_to_day(self, client, test_users_and_plan, auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}/exercises",
            json={"exercise_id": test_users_and_plan["second_exercise_id"]},
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    # --- RemoveExerciseFromDay: DELETE /{plan_id}/days/{day_id}/exercises/{workout_exercise_id} ---

    def test_view_grantee_rejected_on_remove_exercise(self, client, test_users_and_plan, auth_headers):
        response = client.delete(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_remove_exercise(self, client, test_users_and_plan, auth_headers):
        response = client.delete(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    def test_edit_grantee_can_remove_exercise(self, client, test_users_and_plan, auth_headers):
        response = client.delete(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 204

    def test_owner_can_remove_exercise(self, client, test_session_factory, test_users_and_plan, auth_headers):
        # Add a fresh exercise to remove, so this test doesn't depend on execution order
        # relative to the grantee-removal test above (each test gets a fresh DB anyway,
        # but this keeps the test self-contained and explicit).
        session = test_session_factory()
        we = WorkoutExerciseModel(
            id=2,
            plan_day_id=test_users_and_plan["day_id"],
            exercise_id=test_users_and_plan["second_exercise_id"],
            order_number=2,
        )
        session.add(we)
        session.commit()
        we_id = we.id
        session.close()

        response = client.delete(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{we_id}",
            headers=auth_headers["owner"],
        )
        assert response.status_code == 204

    # --- UpdateExerciseInDay: PUT /{plan_id}/days/{day_id}/exercises/{workout_exercise_id} ---

    def test_owner_can_update_exercise_in_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            json={"target_sets": 5},
            headers=auth_headers["owner"],
        )
        assert response.status_code == 200
        assert response.json()["target_sets"] == 5

    def test_edit_grantee_can_update_exercise_in_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            json={"target_sets": 5},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200
        assert response.json()["target_sets"] == 5

    def test_view_grantee_rejected_on_update_exercise_in_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            json={"target_sets": 99},
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_update_exercise_in_day(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}",
            json={"target_sets": 99},
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    # --- set-targets: PUT .../exercises/{workout_exercise_id}/set-targets ---

    def test_owner_can_update_set_targets(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}/set-targets",
            json=[{"set_number": 1, "target_reps": "8", "target_weight": 135.0}],
            headers=auth_headers["owner"],
        )
        assert response.status_code == 200
        assert response.json()["set_targets"][0]["target_reps"] == "8"

    def test_edit_grantee_can_update_set_targets(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}/set-targets",
            json=[{"set_number": 1, "target_reps": "8", "target_weight": 135.0}],
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200
        assert response.json()["set_targets"][0]["target_reps"] == "8"

    def test_view_grantee_rejected_on_update_set_targets(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}/set-targets",
            json=[{"set_number": 1, "target_reps": "8", "target_weight": 135.0}],
            headers=auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_update_set_targets(self, client, test_users_and_plan, auth_headers):
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}/days/{test_users_and_plan['day_id']}"
            f"/exercises/{test_users_and_plan['workout_exercise_id']}/set-targets",
            json=[{"set_number": 1, "target_reps": "8", "target_weight": 135.0}],
            headers=auth_headers["stranger"],
        )
        assert response.status_code == 403

    # --- Revoked-share regression: an edit-tier grantee loses access once the share is revoked ---

    def test_edit_grantee_rejected_after_share_revoked(
        self, client, test_session_factory, test_users_and_plan, auth_headers
    ):
        # Sanity: grantee can edit while the share is active.
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Still active"},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 200

        # Revoke the share directly (soft-revoke, matching how the real revoke endpoint works).
        from datetime import datetime

        session = test_session_factory()
        share = session.get(PlanShareModel, test_users_and_plan["share_id"])
        share.revoked_at = datetime.utcnow()
        session.commit()
        session.close()

        # Same grantee, same permission row still in the DB, but the share itself is now revoked.
        response = client.put(
            f"/api/workout-plans/{test_users_and_plan['plan_id']}",
            json={"name": "Should be rejected"},
            headers=auth_headers["edit_grantee"],
        )
        assert response.status_code == 403, (
            f"Expected 403 after revocation, got {response.status_code}: {response.json()}"
        )


class TestPlanEditViaShareWeeksEndpoints:
    """CustomizeWeek and MatchPreviousWeek - the two weeks-type-plan-only endpoints."""

    @pytest.fixture
    def weeks_auth_headers(self):
        from src.infrastructure.security.jwt_service import create_access_token

        return {
            "owner": {"Authorization": f"Bearer {create_access_token(1)}"},
            "edit_grantee": {"Authorization": f"Bearer {create_access_token(2)}"},
            "view_grantee": {"Authorization": f"Bearer {create_access_token(3)}"},
            "stranger": {"Authorization": f"Bearer {create_access_token(4)}"},
        }

    # --- CustomizeWeek: POST /{plan_id}/weeks/{week_number}/customize ---

    def test_view_grantee_rejected_on_customize_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/customize",
            headers=weeks_auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_customize_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/customize",
            headers=weeks_auth_headers["stranger"],
        )
        assert response.status_code == 403

    def test_edit_grantee_can_customize_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/customize",
            headers=weeks_auth_headers["edit_grantee"],
        )
        assert response.status_code == 204

    def test_owner_can_customize_week(self, client, test_session_factory, test_users_and_weeks_plan, weeks_auth_headers):
        # Use a fresh plan (own weeks-plan setup) so this doesn't depend on execution
        # order relative to the grantee test above.
        session = test_session_factory()
        plan = WorkoutPlanModel(id=2, user_id=1, name="Owner Weeks Plan", unit_type="weeks", total_units=2)
        session.add(plan)
        session.commit()
        w1 = PlanWeekModel(id=3, workout_plan_id=plan.id, week_number=1, mode="base")
        w2 = PlanWeekModel(id=4, workout_plan_id=plan.id, week_number=2, mode="linked")
        session.add_all([w1, w2])
        session.commit()
        day = PlanDayModel(id=2, workout_plan_id=plan.id, plan_week_id=w1.id, label="D1", order_position=1)
        session.add(day)
        session.commit()
        plan_id = plan.id
        session.close()

        response = client.post(
            f"/api/workout-plans/{plan_id}/weeks/2/customize",
            headers=weeks_auth_headers["owner"],
        )
        assert response.status_code == 204

    # --- MatchPreviousWeek: POST /{plan_id}/weeks/{week_number}/match-previous ---

    def test_view_grantee_rejected_on_match_previous_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/match-previous",
            headers=weeks_auth_headers["view_grantee"],
        )
        assert response.status_code == 403

    def test_stranger_rejected_on_match_previous_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/match-previous",
            headers=weeks_auth_headers["stranger"],
        )
        assert response.status_code == 403

    def test_edit_grantee_can_match_previous_week(self, client, test_users_and_weeks_plan, weeks_auth_headers):
        response = client.post(
            f"/api/workout-plans/{test_users_and_weeks_plan['plan_id']}/weeks/2/match-previous",
            headers=weeks_auth_headers["edit_grantee"],
        )
        assert response.status_code == 204

    def test_owner_can_match_previous_week(self, client, test_session_factory, test_users_and_weeks_plan, weeks_auth_headers):
        session = test_session_factory()
        plan = WorkoutPlanModel(id=2, user_id=1, name="Owner Weeks Plan", unit_type="weeks", total_units=2)
        session.add(plan)
        session.commit()
        w1 = PlanWeekModel(id=3, workout_plan_id=plan.id, week_number=1, mode="base")
        w2 = PlanWeekModel(id=4, workout_plan_id=plan.id, week_number=2, mode="linked")
        session.add_all([w1, w2])
        session.commit()
        day = PlanDayModel(id=2, workout_plan_id=plan.id, plan_week_id=w1.id, label="D1", order_position=1)
        session.add(day)
        session.commit()
        plan_id = plan.id
        session.close()

        response = client.post(
            f"/api/workout-plans/{plan_id}/weeks/2/match-previous",
            headers=weeks_auth_headers["owner"],
        )
        assert response.status_code == 204
