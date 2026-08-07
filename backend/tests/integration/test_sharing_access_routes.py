"""Integration tests for shared-plan access endpoint (Phase 3).

Tests the public shared-plan access endpoint:
- GET /api/shared/{token} (anonymous and authenticated access)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from src.app import app
from src.infrastructure.database import Base, get_db
from src.infrastructure.security.jwt_service import create_access_token
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_sharing_access.db"
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
def owner_user(test_session_factory):
    """Create and return the plan owner."""
    session = test_session_factory()
    user = UserModel(
        username="owner",
        display_name="Plan Owner",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "owner"}


@pytest.fixture
def granted_user(test_session_factory):
    """Create and return a user who will be granted access."""
    session = test_session_factory()
    user = UserModel(
        username="granteduser",
        display_name="Granted User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "granteduser"}


@pytest.fixture
def ungranted_user(test_session_factory):
    """Create and return a user who is not granted access."""
    session = test_session_factory()
    user = UserModel(
        username="ungranteduser",
        display_name="Ungranted User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "ungranteduser"}


@pytest.fixture
def owner_plan(test_session_factory, owner_user):
    """Create and return a test plan owned by owner_user."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=owner_user["id"],
        name="Test Plan",
        unit_type="days",
    )
    session.add(plan)
    session.commit()
    plan_id = plan.id
    session.close()
    return {"id": plan_id, "user_id": owner_user["id"]}


@pytest.fixture
def owner_plan_with_exercise(test_session_factory, owner_user):
    """Create a test plan owned by owner_user with an exercise on a day."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=owner_user["id"],
        name="Test Plan with Exercise",
        unit_type="days",
    )
    session.add(plan)
    session.commit()
    plan_id = plan.id

    # Add a day
    day = PlanDayModel(
        workout_plan_id=plan_id,
        order_position=1,
        label="Day 1",
    )
    session.add(day)
    session.commit()
    day_id = day.id

    # Add an exercise
    exercise = ExerciseModel(
        user_id=owner_user["id"],
        name="Bench Press",
    )
    session.add(exercise)
    session.commit()
    exercise_id = exercise.id

    # Add exercise to the day
    wo_exercise = WorkoutExerciseModel(
        plan_day_id=day_id,
        exercise_id=exercise_id,
        order_number=1,
    )
    session.add(wo_exercise)
    session.commit()
    wo_exercise_id = wo_exercise.id
    session.close()

    return {
        "id": plan_id,
        "user_id": owner_user["id"],
        "day_id": day_id,
        "exercise_id": exercise_id,
        "wo_exercise_id": wo_exercise_id,
    }


@pytest.fixture
def owner_weeks_plan_with_exercise(test_session_factory, owner_user):
    """Create a test weeks-type plan owned by owner_user with an exercise."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=owner_user["id"],
        name="Test Weeks Plan with Exercise",
        unit_type="weeks",
        total_units=2,
    )
    session.add(plan)
    session.commit()
    plan_id = plan.id

    # Add a week
    week = PlanWeekModel(
        workout_plan_id=plan_id,
        week_number=1,
        mode="base",
    )
    session.add(week)
    session.commit()
    week_id = week.id

    # Add a day in the week
    day = PlanDayModel(
        workout_plan_id=plan_id,
        plan_week_id=week_id,
        order_position=1,
        label="Monday",
    )
    session.add(day)
    session.commit()
    day_id = day.id

    # Add an exercise
    exercise = ExerciseModel(
        user_id=owner_user["id"],
        name="Squat",
    )
    session.add(exercise)
    session.commit()
    exercise_id = exercise.id

    # Add exercise to the day
    wo_exercise = WorkoutExerciseModel(
        plan_day_id=day_id,
        exercise_id=exercise_id,
        order_number=1,
    )
    session.add(wo_exercise)
    session.commit()
    wo_exercise_id = wo_exercise.id
    session.close()

    return {
        "id": plan_id,
        "user_id": owner_user["id"],
        "week_id": week_id,
        "day_id": day_id,
        "exercise_id": exercise_id,
        "wo_exercise_id": wo_exercise_id,
    }


@pytest.fixture
def owner_auth_headers(owner_user):
    """Create auth headers for owner_user."""
    token = create_access_token(owner_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def granted_auth_headers(granted_user):
    """Create auth headers for granted_user."""
    token = create_access_token(granted_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def ungranted_auth_headers(ungranted_user):
    """Create auth headers for ungranted_user."""
    token = create_access_token(ungranted_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def plan_share(client, owner_plan, owner_auth_headers, test_session_factory):
    """Helper to create a share for testing."""
    # Create share via endpoint
    resp = client.post(
        f"/api/workout-plans/{owner_plan['id']}/share",
        headers=owner_auth_headers,
        json={},
    )
    assert resp.status_code == 201
    return resp.json()


class TestSharedPlanAccessAnonymous:
    """Tests for anonymous access to shared plans."""

    def test_anonymous_access_anyone_mode_view(self, client, owner_plan, owner_auth_headers, plan_share):
        """Anonymous access to anyone-mode share with view permission returns 200."""
        share = plan_share

        # Update to mode='anyone', link_permission='view'
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200

        # Access anonymously
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "view"
        assert data["plan_owner_username"] == "owner"
        assert data["share"]["mode"] == "anyone"
        assert "plan" in data
        assert "days" in data or "weeks" in data

    def test_cannot_configure_anyone_mode_with_log_permission(self, client, owner_plan, owner_auth_headers, plan_share):
        """A public 'anyone' link can no longer be configured with log permission (422).

        Anonymous log access was deliberately disabled - see
        UpdateShare.execute()'s InvalidShareConfigurationError check. Log/edit access
        now requires a per-username grant to a specific, authenticated person.
        """
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "log"},
        )
        assert update_resp.status_code == 422

    def test_cannot_configure_anyone_mode_with_edit_permission(self, client, owner_plan, owner_auth_headers, plan_share):
        """A public 'anyone' link can no longer be configured with edit permission (422)."""
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "edit"},
        )
        assert update_resp.status_code == 422

    def test_anonymous_access_restricted_mode_returns_403(self, client, owner_plan, plan_share):
        """Anonymous access to restricted-mode share returns 403, NOT 401.

        This is the critical test to prevent the frontend 401 interceptor
        from redirecting anonymous users to /login.
        """
        share = plan_share
        # Share defaults to mode='restricted'

        # Access anonymously
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 403, "Restricted share should return 403, not 401"
        assert "permission" not in resp.json()


class TestSharedPlanAccessAuthenticated:
    """Tests for authenticated access to shared plans."""

    def test_granted_user_restricted_mode_returns_200(self, client, owner_plan, owner_auth_headers, granted_user, plan_share):
        """Granted user with restricted mode returns 200 with their permission tier."""
        share = plan_share

        # Add grant to granted_user with 'log' permission
        grant_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "granteduser", "permission": "log"},
        )
        assert grant_resp.status_code == 201

        # Access as granted_user
        token = create_access_token(granted_user["id"])
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(f"/api/shared/{share['token']}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "log"

    def test_ungranted_user_restricted_mode_returns_403(self, client, owner_plan, owner_auth_headers, granted_user, ungranted_user, plan_share):
        """Ungranted user with restricted mode returns 403."""
        share = plan_share

        # Add grant to granted_user
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "granteduser", "permission": "log"},
        )

        # Try to access as ungranted_user
        token = create_access_token(ungranted_user["id"])
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(f"/api/shared/{share['token']}", headers=headers)
        assert resp.status_code == 403
        data = resp.json()
        assert "permission" not in data

    def test_owner_via_token_gets_edit(self, client, owner_plan, owner_auth_headers, plan_share):
        """Plan owner accessing via share token gets 'edit' permission."""
        share = plan_share

        # Access as owner
        resp = client.get(f"/api/shared/{share['token']}", headers=owner_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "edit"


class TestSharedPlanAccessGrantTiers:
    """Tests for grant tier vs. link tier resolution."""

    def test_grant_tier_stronger_than_link_tier(self, client, owner_plan, owner_auth_headers, granted_user, plan_share):
        """If grant tier > link tier, use grant tier (via permission_at_least)."""
        share = plan_share

        # Set to anyone mode with 'view' link_permission
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200

        # Grant 'log' to granted_user (stronger than 'view')
        grant_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "granteduser", "permission": "log"},
        )
        assert grant_resp.status_code == 201

        # Access as granted_user → should get 'log' (stronger)
        token = create_access_token(granted_user["id"])
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(f"/api/shared/{share['token']}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "log"

    def test_link_tier_stronger_than_grant_tier(
        self, client, owner_plan, owner_auth_headers, granted_user, plan_share, test_session_factory
    ):
        """If link tier > grant tier, use link tier (via permission_at_least).

        mode='anyone' with link_permission='edit' can no longer be reached through
        the normal PUT /share endpoint (UpdateShare now rejects it - a public link
        may only ever grant 'view'). This scenario is constructed directly via the
        repository instead, to keep independently verifying that
        ResolveShareAccess's merge logic is still correct for it - e.g. against
        rows that predate this rule, or if a future feature reintroduces a
        stronger link tier.
        """
        share = plan_share
        session = test_session_factory()
        share_repo = PlanShareRepositoryImpl(session)
        share_entity = share_repo.get_by_plan(owner_plan["id"])
        share_entity.mode = "anyone"
        share_entity.link_permission = "edit"
        share_repo.update(share_entity)
        session.close()

        # Grant 'log' to granted_user (weaker than 'edit')
        grant_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "granteduser", "permission": "log"},
        )
        assert grant_resp.status_code == 201

        # Access as granted_user → should get 'edit' (stronger)
        token = create_access_token(granted_user["id"])
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(f"/api/shared/{share['token']}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "edit"

    def test_grant_and_link_same_tier(
        self, client, owner_plan, owner_auth_headers, granted_user, plan_share, test_session_factory
    ):
        """If grant tier == link tier, use that tier.

        Constructed directly via the repository (see
        test_link_tier_stronger_than_grant_tier above) since mode='anyone' with
        link_permission='log' can no longer be reached through PUT /share.
        """
        share = plan_share
        session = test_session_factory()
        share_repo = PlanShareRepositoryImpl(session)
        share_entity = share_repo.get_by_plan(owner_plan["id"])
        share_entity.mode = "anyone"
        share_entity.link_permission = "log"
        share_repo.update(share_entity)
        session.close()

        # Grant 'log' to granted_user (same)
        grant_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "granteduser", "permission": "log"},
        )
        assert grant_resp.status_code == 201

        # Access as granted_user → should get 'log'
        token = create_access_token(granted_user["id"])
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(f"/api/shared/{share['token']}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "log"


class TestSharedPlanAccessRevokedAndMissing:
    """Tests for revoked and missing share tokens."""

    def test_revoked_token_returns_404(self, client, owner_plan, owner_auth_headers, plan_share):
        """Accessing a revoked share returns 404."""
        share = plan_share

        # Revoke the share
        revoke_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )
        assert revoke_resp.status_code == 200

        # Try to access
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 404

    def test_garbage_token_returns_404(self, client):
        """Accessing with a garbage token returns 404."""
        resp = client.get("/api/shared/not_a_real_token_12345")
        assert resp.status_code == 404


class TestSharedPlanResponseFormat:
    """Tests for the response format."""

    def test_response_includes_plan_detail(self, client, owner_plan, owner_auth_headers, plan_share):
        """Response includes full plan detail structure."""
        share = plan_share

        # Update to anyone mode
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone"},
        )
        assert update_resp.status_code == 200

        # Access
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 200
        data = resp.json()

        # Check plan structure
        assert "plan" in data
        assert data["plan"]["id"] == owner_plan["id"]
        assert data["plan"]["name"] == "Test Plan"
        assert data["plan"]["user_id"] == owner_plan["user_id"]

        # Check plan day/week structure
        assert "days" in data or "weeks" in data

    def test_response_includes_sharing_info(self, client, owner_plan, owner_auth_headers, plan_share):
        """Response includes sharing info (permission, owner, mode)."""
        share = plan_share

        # Update to anyone mode
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone"},
        )
        assert update_resp.status_code == 200

        # Access
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 200
        data = resp.json()

        # Check sharing info
        assert "permission" in data
        assert "plan_owner_username" in data
        assert "share" in data
        assert "mode" in data["share"]
        assert data["share"]["mode"] == "anyone"


class TestSharedPlanWithContent:
    """Tests for shared plans with actual days/exercises (regression tests for Task 88).

    These tests verify that GET /api/shared/{token} correctly serializes and returns
    real plan content (days/weeks with exercises) instead of crashing with a 500 error.
    """

    def test_days_type_plan_with_exercise_returns_200_with_content(
        self, client, owner_user, owner_plan_with_exercise, owner_auth_headers
    ):
        """Test viewing a days-type plan with actual exercises (regression: Task 88).

        This is the exact scenario that was failing with a 500 error:
        - Plan has at least one day
        - Day has at least one exercise on it
        - Call GET /api/shared/{token} as an authenticated user with access
        - Should return 200 with real exercise data in the days list
        """
        plan = owner_plan_with_exercise

        # Create a share for the plan
        share_resp = client.post(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert share_resp.status_code == 201
        share_token = share_resp.json()["token"]

        # Update to anyone mode so the test can access it anonymously or as granted user
        update_resp = client.put(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200

        # Access the shared plan as an authenticated user with view permission
        resp = client.get(f"/api/shared/{share_token}", headers=owner_auth_headers)

        # Should return 200 (not 500)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

        data = resp.json()

        # Verify basic structure
        assert "permission" in data
        assert data["permission"] == "edit"  # owner gets edit
        assert "plan_owner_username" in data
        assert data["plan_owner_username"] == "owner"
        assert "share" in data
        assert data["share"]["mode"] == "anyone"

        # Verify the plan is for days-type
        assert "plan" in data
        assert data["plan"]["unit_type"] == "days"

        # Verify days list exists and has content (not empty)
        assert "days" in data
        assert data["days"] is not None
        assert len(data["days"]) > 0

        # Verify the day has the expected structure and exercises
        day = data["days"][0]
        assert "id" in day
        assert "label" in day
        assert day["label"] == "Day 1"
        assert "order_position" in day
        assert day["order_position"] == 1
        assert "exercises" in day

        # Verify the exercise is in the day
        assert len(day["exercises"]) > 0
        exercise = day["exercises"][0]
        assert "exercise_id" in exercise
        assert exercise["exercise_id"] == plan["exercise_id"]
        assert "exercise_name" in exercise
        assert exercise["exercise_name"] == "Bench Press"

    def test_weeks_type_plan_with_exercise_returns_200_with_content(
        self, client, owner_user, owner_weeks_plan_with_exercise, owner_auth_headers
    ):
        """Test viewing a weeks-type plan with actual exercises (regression: Task 88).

        The weeks-type plan path has the identical bug pattern as days-type,
        and was never tested with actual content before. This verifies:
        - Plan has at least one week with a day
        - Day has at least one exercise on it
        - Call GET /api/shared/{token} as an authenticated user with access
        - Should return 200 with real exercise data in the weeks list
        """
        plan = owner_weeks_plan_with_exercise

        # Create a share for the plan
        share_resp = client.post(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert share_resp.status_code == 201
        share_token = share_resp.json()["token"]

        # Update to anyone mode
        update_resp = client.put(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200

        # Access the shared plan as owner
        resp = client.get(f"/api/shared/{share_token}", headers=owner_auth_headers)

        # Should return 200 (not 500)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

        data = resp.json()

        # Verify basic structure
        assert "permission" in data
        assert data["permission"] == "edit"  # owner gets edit
        assert "plan_owner_username" in data
        assert data["plan_owner_username"] == "owner"

        # Verify the plan is for weeks-type
        assert "plan" in data
        assert data["plan"]["unit_type"] == "weeks"

        # Verify weeks list exists and has content (not empty)
        assert "weeks" in data
        assert data["weeks"] is not None
        assert len(data["weeks"]) > 0

        # Verify the week has the expected structure
        week = data["weeks"][0]
        assert "week_number" in week
        assert week["week_number"] == 1
        assert "mode" in week
        assert week["mode"] == "base"
        assert "days" in week

        # Verify the day in the week has exercises
        assert len(week["days"]) > 0
        day = week["days"][0]
        assert "label" in day
        assert day["label"] == "Monday"
        assert "exercises" in day

        # Verify the exercise is in the day
        assert len(day["exercises"]) > 0
        exercise = day["exercises"][0]
        assert "exercise_id" in exercise
        assert exercise["exercise_id"] == plan["exercise_id"]
        assert "exercise_name" in exercise
        assert exercise["exercise_name"] == "Squat"

    def test_anonymous_access_anyone_mode_with_non_empty_plan(
        self, client, owner_user, owner_plan_with_exercise, owner_auth_headers
    ):
        """Test anonymous access to a non-empty anyone-mode plan (verify all paths work).

        Existing anonymous tests used empty plans (no days). This verifies anonymous
        access still works correctly with actual content.
        """
        plan = owner_plan_with_exercise

        # Create and configure share
        share_resp = client.post(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert share_resp.status_code == 201
        share_token = share_resp.json()["token"]

        # Update to anyone mode with view permission
        update_resp = client.put(
            f"/api/workout-plans/{plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200

        # Access anonymously (no auth header)
        resp = client.get(f"/api/shared/{share_token}")

        # Should return 200 (not 500)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

        data = resp.json()

        # Verify access info
        assert "permission" in data
        assert data["permission"] == "view"
        assert "plan_owner_username" in data
        assert data["plan_owner_username"] == "owner"

        # Verify days list has content
        assert "days" in data
        assert data["days"] is not None
        assert len(data["days"]) > 0

        # Verify exercise is present
        day = data["days"][0]
        assert len(day["exercises"]) > 0
        exercise = day["exercises"][0]
        assert "exercise_name" in exercise
        assert exercise["exercise_name"] == "Bench Press"
