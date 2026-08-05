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

    def test_anonymous_access_anyone_mode_log(self, client, owner_plan, owner_auth_headers, plan_share):
        """Anonymous access to anyone-mode share with log permission returns 200."""
        share = plan_share

        # Update to mode='anyone', link_permission='log'
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "log"},
        )
        assert update_resp.status_code == 200

        # Access anonymously
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "log"

    def test_anonymous_access_anyone_mode_edit(self, client, owner_plan, owner_auth_headers, plan_share):
        """Anonymous access to anyone-mode share with edit permission returns 200."""
        share = plan_share

        # Update to mode='anyone', link_permission='edit'
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "edit"},
        )
        assert update_resp.status_code == 200

        # Access anonymously
        resp = client.get(f"/api/shared/{share['token']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["permission"] == "edit"

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

    def test_link_tier_stronger_than_grant_tier(self, client, owner_plan, owner_auth_headers, granted_user, plan_share):
        """If link tier > grant tier, use link tier (via permission_at_least)."""
        share = plan_share

        # Set to anyone mode with 'edit' link_permission
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "edit"},
        )
        assert update_resp.status_code == 200

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

    def test_grant_and_link_same_tier(self, client, owner_plan, owner_auth_headers, granted_user, plan_share):
        """If grant tier == link tier, use that tier."""
        share = plan_share

        # Set to anyone mode with 'log' link_permission
        update_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "log"},
        )
        assert update_resp.status_code == 200

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
