"""Integration tests for sharing/share-management endpoints (Phase 2).

Tests the owner-only share management endpoints:
- POST /api/workout-plans/{plan_id}/share (create/un-revoke)
- GET /api/workout-plans/{plan_id}/share (get config + grants)
- PUT /api/workout-plans/{plan_id}/share (update mode/link_permission)
- POST /api/workout-plans/{plan_id}/share/revoke (soft revoke)
- POST /api/workout-plans/{plan_id}/share/grants (add grant)
- DELETE /api/workout-plans/{plan_id}/share/grants/{username} (remove grant)
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
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_sharing.db"
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
def other_user(test_session_factory):
    """Create and return another user (for grants)."""
    session = test_session_factory()
    user = UserModel(
        username="otheruser",
        display_name="Other User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "otheruser"}


@pytest.fixture
def non_owner_user(test_session_factory):
    """Create and return a user who doesn't own the plan."""
    session = test_session_factory()
    user = UserModel(
        username="nonowner",
        display_name="Non Owner",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "nonowner"}


@pytest.fixture
def owner_plan(test_session_factory, owner_user):
    """Create and return a test plan owned by owner_user."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=owner_user["id"],
        name="Test Plan",
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
def other_auth_headers(other_user):
    """Create auth headers for other_user."""
    token = create_access_token(other_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def non_owner_auth_headers(non_owner_user):
    """Create auth headers for non_owner_user."""
    token = create_access_token(non_owner_user["id"])
    return {"Authorization": f"Bearer {token}"}


class TestShareCreation:
    """Tests for creating shares."""

    def test_create_share_returns_token_and_defaults(self, client, owner_plan, owner_auth_headers):
        """POST /share creates a share with default mode='restricted', link_permission='view'."""
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] is not None
        assert data["token"] is not None
        assert len(data["token"]) >= 40  # Ensure token is long enough
        assert data["mode"] == "restricted"
        assert data["link_permission"] == "view"
        assert data["created_at"] is not None
        assert data["revoked_at"] is None
        assert data["grants"] == []

    def test_create_share_nonexistent_plan(self, client, owner_auth_headers):
        """POST /share on nonexistent plan returns 404."""
        resp = client.post(
            "/api/workout-plans/9999/share",
            headers=owner_auth_headers,
            json={},
        )
        assert resp.status_code == 404

    def test_create_share_non_owner(self, client, owner_plan, non_owner_auth_headers):
        """POST /share as non-owner returns 403."""
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=non_owner_auth_headers,
            json={},
        )
        assert resp.status_code == 403

    def test_create_share_unauthenticated(self, client, owner_plan):
        """POST /share without auth returns 401."""
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            json={},
        )
        assert resp.status_code == 401


class TestShareRetrieval:
    """Tests for retrieving shares."""

    def test_get_share_existing(self, client, owner_plan, owner_auth_headers):
        """GET /share returns the share config."""
        # Create first
        create_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        created_token = create_resp.json()["token"]

        # Retrieve
        resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token"] == created_token
        assert data["mode"] == "restricted"
        assert data["link_permission"] == "view"

    def test_get_share_not_found(self, client, owner_plan, owner_auth_headers):
        """GET /share when no share exists returns 404."""
        resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        assert resp.status_code == 404

    def test_get_share_non_owner(self, client, owner_plan, owner_auth_headers, non_owner_auth_headers):
        """GET /share as non-owner returns 403."""
        # Create first
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Try to retrieve as non-owner
        resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=non_owner_auth_headers,
        )
        assert resp.status_code == 403


class TestShareUpdate:
    """Tests for updating shares."""

    def test_update_mode(self, client, owner_plan, owner_auth_headers):
        """PUT /share updates mode."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Update
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "anyone"
        assert data["link_permission"] == "view"  # Unchanged

    def test_update_link_permission(self, client, owner_plan, owner_auth_headers):
        """PUT /share updates link_permission."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Update
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"link_permission": "edit"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "restricted"  # Unchanged
        assert data["link_permission"] == "edit"

    def test_update_both(self, client, owner_plan, owner_auth_headers):
        """PUT /share updates both mode and link_permission (valid combination)."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Update - restricted mode may carry any link_permission value (it's simply
        # unused while restricted; only 'anyone' mode restricts it to 'view').
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "restricted", "link_permission": "log"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "restricted"
        assert data["link_permission"] == "log"

    def test_update_anyone_mode_rejects_log_permission(self, client, owner_plan, owner_auth_headers):
        """PUT /share with mode='anyone' + link_permission='log' is rejected (422).

        A public link may only ever grant view access - log/edit access requires a
        per-username grant to a specific, authenticated person instead.
        """
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "log"},
        )
        assert resp.status_code == 422

    def test_update_anyone_mode_rejects_edit_permission(self, client, owner_plan, owner_auth_headers):
        """PUT /share with mode='anyone' + link_permission='edit' is rejected (422)."""
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "edit"},
        )
        assert resp.status_code == 422

    def test_update_anyone_mode_allows_view_permission(self, client, owner_plan, owner_auth_headers):
        """PUT /share with mode='anyone' + link_permission='view' succeeds (200)."""
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "anyone"
        assert data["link_permission"] == "view"

    def test_update_mode_alone_rejected_if_leftover_permission_invalid(
        self, client, owner_plan, owner_auth_headers
    ):
        """Switching mode='anyone' alone is rejected if link_permission is already log/edit.

        The validation must consider the RESULTING combination, not just the field(s)
        present in this specific request - a prior request may have already set
        link_permission='log' while mode was still 'restricted' (a harmless, allowed
        combination at the time), and only this later request is what actually
        produces the disallowed 'anyone' + 'log' combination.
        """
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        # First set link_permission='log' while still restricted - allowed, unused.
        setup_resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"link_permission": "log"},
        )
        assert setup_resp.status_code == 200

        # Now switch mode alone - the resulting combination (anyone + log) must be rejected.
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone"},
        )
        assert resp.status_code == 422

    def test_update_invalid_mode(self, client, owner_plan, owner_auth_headers):
        """PUT /share with invalid mode returns 422."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Try to update with invalid mode
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"mode": "invalid"},
        )
        assert resp.status_code == 422

    def test_update_invalid_permission(self, client, owner_plan, owner_auth_headers):
        """PUT /share with invalid link_permission returns 422."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Try to update with invalid permission
        resp = client.put(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={"link_permission": "invalid"},
        )
        assert resp.status_code == 422


class TestShareRevocation:
    """Tests for revoking shares."""

    def test_revoke_share(self, client, owner_plan, owner_auth_headers):
        """POST /revoke sets revoked_at."""
        # Create
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Revoke
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["revoked_at"] is not None

    def test_revoke_already_revoked_is_idempotent(self, client, owner_plan, owner_auth_headers):
        """POST /revoke on already-revoked share is idempotent (200, not error)."""
        # Create and revoke
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        first_revoke = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )
        first_revoke_time = first_revoke.json()["revoked_at"]

        # Revoke again
        second_revoke = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )
        assert second_revoke.status_code == 200
        second_revoke_time = second_revoke.json()["revoked_at"]
        assert first_revoke_time is not None
        assert second_revoke_time is not None


class TestShareUnrevoke:
    """Tests for un-revoking shares (re-creation)."""

    def test_create_share_after_revoke_unrevolkes_it(self, client, owner_plan, owner_auth_headers, test_session_factory):
        """POST /share after revoking un-revokes the existing share."""
        # Create
        first_create = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        token_1 = first_create.json()["token"]

        # Revoke
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )

        # Create again (should un-revoke)
        second_create = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        token_2 = second_create.json()["token"]
        revoked_at = second_create.json()["revoked_at"]

        # Same token (row reused, not new)
        assert token_1 == token_2
        # Un-revoked (revoked_at is null again)
        assert revoked_at is None

        # Verify via repo that token still resolves
        session = test_session_factory()
        repo = PlanShareRepositoryImpl(session)
        share = repo.get_by_token(token_2)
        assert share is not None
        assert share.is_active
        session.close()


class TestGrants:
    """Tests for managing grants."""

    def test_add_grant(self, client, owner_plan, owner_auth_headers, other_user):
        """POST /grants adds a grant for a user."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add grant
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "otheruser"
        assert data["display_name"] == "Other User"
        assert data["permission"] == "log"

    def test_add_grant_appears_in_share_response(self, client, owner_plan, owner_auth_headers, other_user):
        """A grant added is listed in GET /share."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add grant
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )

        # Get share
        resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        data = resp.json()
        assert len(data["grants"]) == 1
        assert data["grants"][0]["username"] == "otheruser"
        assert data["grants"][0]["permission"] == "log"

    def test_add_grant_nonexistent_user_returns_404(self, client, owner_plan, owner_auth_headers):
        """POST /grants with nonexistent username returns 404."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Try to add grant for nonexistent user
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "doesnotexist", "permission": "log"},
        )
        assert resp.status_code == 404
        assert "User not found" in resp.json()["error"]

    def test_add_grant_to_owner_returns_400(self, client, owner_plan, owner_auth_headers):
        """POST /grants to the plan owner returns 400."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Try to grant to owner
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "owner", "permission": "log"},
        )
        assert resp.status_code == 400

    def test_upgrade_grant_permission(self, client, owner_plan, owner_auth_headers, other_user):
        """Adding a grant to a user who already has one updates their permission."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add first grant (view)
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "view"},
        )

        # Add second grant for same user (log) — should update
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["permission"] == "log"

        # Verify only one grant exists
        get_resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        get_data = get_resp.json()
        assert len(get_data["grants"]) == 1
        assert get_data["grants"][0]["permission"] == "log"

    def test_delete_grant(self, client, owner_plan, owner_auth_headers, other_user):
        """DELETE /grants/{username} removes the grant."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add grant
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )

        # Delete grant
        resp = client.delete(
            f"/api/workout-plans/{owner_plan['id']}/share/grants/otheruser",
            headers=owner_auth_headers,
        )
        assert resp.status_code == 204

        # Verify it's gone
        get_resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        get_data = get_resp.json()
        assert len(get_data["grants"]) == 0

    def test_delete_grant_nonexistent_is_idempotent(self, client, owner_plan, owner_auth_headers):
        """DELETE /grants/{username} for nonexistent grant returns 204 (no error)."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Delete nonexistent grant
        resp = client.delete(
            f"/api/workout-plans/{owner_plan['id']}/share/grants/doesnotexist",
            headers=owner_auth_headers,
        )
        assert resp.status_code == 204


class TestGrantsCaseInsensitive:
    """Tests for case-insensitive username handling in grants."""

    def test_add_grant_case_insensitive(self, client, owner_plan, owner_auth_headers, other_user):
        """POST /grants with different-case username resolves the user."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add grant with uppercase username
        resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "OtherUser", "permission": "log"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "otheruser"  # Returns canonical username

    def test_delete_grant_case_insensitive(self, client, owner_plan, owner_auth_headers, other_user):
        """DELETE /grants/{username} with different-case username removes the grant."""
        # Create share
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )

        # Add grant
        client.post(
            f"/api/workout-plans/{owner_plan['id']}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )

        # Delete with uppercase username
        resp = client.delete(
            f"/api/workout-plans/{owner_plan['id']}/share/grants/OtherUser",
            headers=owner_auth_headers,
        )
        assert resp.status_code == 204

        # Verify it's gone
        get_resp = client.get(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
        )
        get_data = get_resp.json()
        assert len(get_data["grants"]) == 0


class TestTokenResolution:
    """Tests for verifying token resolution works."""

    def test_created_token_resolves_via_repo(self, client, owner_plan, owner_auth_headers, test_session_factory):
        """The token returned in POST /share resolves via PlanShareRepository.get_by_token."""
        # Create share
        create_resp = client.post(
            f"/api/workout-plans/{owner_plan['id']}/share",
            headers=owner_auth_headers,
            json={},
        )
        token = create_resp.json()["token"]

        # Resolve via repo
        session = test_session_factory()
        repo = PlanShareRepositoryImpl(session)
        share = repo.get_by_token(token)
        assert share is not None
        assert share.token == token
        assert share.workout_plan_id == owner_plan["id"]
        session.close()


class TestRoundTripWorkflow:
    """Tests for the full round-trip workflow."""

    def test_create_get_update_revoke_recreate(self, client, owner_plan, owner_auth_headers, other_user, test_session_factory):
        """Full workflow: create → get → update → revoke → recreate."""
        plan_id = owner_plan["id"]

        # 1. Create
        create_resp = client.post(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert create_resp.status_code == 201
        token_1 = create_resp.json()["token"]
        assert create_resp.json()["mode"] == "restricted"
        assert create_resp.json()["link_permission"] == "view"

        # 2. Get
        get_resp = client.get(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["token"] == token_1

        # 3. Update mode - 'anyone' mode may only carry 'view' permission (log/edit
        # requires a per-username grant instead, added in step 4 below).
        update_resp = client.put(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
            json={"mode": "anyone", "link_permission": "view"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["mode"] == "anyone"
        assert update_resp.json()["link_permission"] == "view"

        # 4. Add a grant
        grant_resp = client.post(
            f"/api/workout-plans/{plan_id}/share/grants",
            headers=owner_auth_headers,
            json={"username": "otheruser", "permission": "log"},
        )
        assert grant_resp.status_code == 201

        # 5. Get and verify grant is there
        get_resp2 = client.get(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
        )
        assert len(get_resp2.json()["grants"]) == 1

        # 6. Revoke
        revoke_resp = client.post(
            f"/api/workout-plans/{plan_id}/share/revoke",
            headers=owner_auth_headers,
            json={},
        )
        assert revoke_resp.status_code == 200
        assert revoke_resp.json()["revoked_at"] is not None

        # 7. Recreate (un-revoke)
        recreate_resp = client.post(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
            json={},
        )
        assert recreate_resp.status_code == 201
        token_2 = recreate_resp.json()["token"]
        assert token_2 == token_1  # Same token (row reused)
        assert recreate_resp.json()["revoked_at"] is None  # Un-revoked

        # 8. Verify grant still exists
        get_resp3 = client.get(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
        )
        assert len(get_resp3.json()["grants"]) == 1
        assert get_resp3.json()["grants"][0]["username"] == "otheruser"

        # 9. Delete grant
        delete_resp = client.delete(
            f"/api/workout-plans/{plan_id}/share/grants/otheruser",
            headers=owner_auth_headers,
        )
        assert delete_resp.status_code == 204

        # 10. Verify grant is gone
        get_resp4 = client.get(
            f"/api/workout-plans/{plan_id}/share",
            headers=owner_auth_headers,
        )
        assert len(get_resp4.json()["grants"]) == 0
