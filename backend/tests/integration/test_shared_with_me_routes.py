"""Integration tests for the 'Shared with me' endpoint.

Tests GET /api/shared-with-me - the grant-based list of plans a user has been
personally given access to, regardless of the parent share's mode.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.app import app
from src.infrastructure.database import Base, get_db
from src.infrastructure.security.jwt_service import create_access_token
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)
from src.modules.sharing.application.use_cases.create_or_unrevoke_share import (
    CreateOrUnrevokeShare,
)
from src.modules.sharing.application.use_cases.update_share import UpdateShare
from src.modules.sharing.application.use_cases.add_share_grant import AddShareGrant
from src.modules.sharing.application.use_cases.revoke_share import RevokeShare
from src.modules.sharing.application.use_cases.remove_share_grant import RemoveShareGrant


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    db_file = tmp_path / "test_shared_with_me.db"
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


@pytest.fixture
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
def owner_user(test_session_factory):
    session = test_session_factory()
    user = UserModel(username="owner", display_name="Plan Owner", password_hash="fake_hash")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "owner"}


@pytest.fixture
def recipient_user(test_session_factory):
    session = test_session_factory()
    user = UserModel(username="recipient", display_name="Recipient", password_hash="fake_hash")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "recipient"}


@pytest.fixture
def stranger_user(test_session_factory):
    session = test_session_factory()
    user = UserModel(username="stranger", display_name="Stranger", password_hash="fake_hash")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "stranger"}


@pytest.fixture
def owner_auth_headers(owner_user):
    token = create_access_token(owner_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def recipient_auth_headers(recipient_user):
    token = create_access_token(recipient_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def stranger_auth_headers(stranger_user):
    token = create_access_token(stranger_user["id"])
    return {"Authorization": f"Bearer {token}"}


def _make_plan(test_session_factory, owner_id: int, name: str) -> int:
    session = test_session_factory()
    plan = WorkoutPlanModel(user_id=owner_id, name=name, unit_type="days")
    session.add(plan)
    session.commit()
    plan_id = plan.id
    session.close()
    return plan_id


class TestSharedWithMe:
    """Tests for GET /api/shared-with-me."""

    def test_shared_plan_appears_for_granted_user(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """FR2: a plan the caller was granted access to appears with the right fields."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Beginner Strength")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        share = CreateOrUnrevokeShare(share_repo).execute(plan_id)
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "log", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["plan_id"] == plan_id
        assert data[0]["plan_name"] == "Beginner Strength"
        assert data[0]["token"] == share.token
        assert data[0]["owner_username"] == "owner"
        assert data[0]["permission"] == "log"

    def test_empty_list_when_no_grants(self, client, recipient_auth_headers):
        """A user with no grants at all gets an empty list, not an error."""
        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_revoked_share_does_not_appear(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """FR4: revoking the share removes it from the recipient's list."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Revoke Test Plan")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_id)
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "view", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert len(resp.json()) == 1

        RevokeShare(share_repo).execute(plan_id)

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.json() == []

    def test_removed_grant_does_not_appear(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """FR4: removing the user's grant removes it from their list (share stays active)."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Remove Grant Test Plan")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_id)
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "view", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert len(resp.json()) == 1

        RemoveShareGrant(share_repo).execute(plan_id, recipient_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.json() == []

    def test_another_users_grant_never_leaks(
        self,
        client,
        test_session_factory,
        owner_user,
        recipient_user,
        stranger_user,
        stranger_auth_headers,
    ):
        """NFR1: a grant belonging to someone else must never appear in my own list."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Private To Recipient")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_id)
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "edit", owner_user["id"])

        # The stranger has no grant on this plan at all - must see nothing.
        resp = client.get("/api/shared-with-me", headers=stranger_auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_appears_regardless_of_share_mode(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """FR2/design decision: grant-based, not mode-based - shows up even in 'anyone' mode."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Anyone Mode Plan")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_id)
        # 'anyone' mode is now capped to link_permission='view' (see UpdateShare), but a
        # personal grant can still raise a specific user above that - and it should still
        # show up in their "Shared with me" list either way.
        UpdateShare(share_repo).execute(plan_id, mode="anyone", link_permission="view")
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "log", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["permission"] == "log"

    def test_multiple_shared_plans_all_appear(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """A user granted access to several plans sees all of them."""
        plan_a = _make_plan(test_session_factory, owner_user["id"], "Plan A")
        plan_b = _make_plan(test_session_factory, owner_user["id"], "Plan B")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_a)
        CreateOrUnrevokeShare(share_repo).execute(plan_b)
        AddShareGrant(share_repo).execute(plan_a, recipient_user["id"], "view", owner_user["id"])
        AddShareGrant(share_repo).execute(plan_b, recipient_user["id"], "edit", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert {e["plan_name"] for e in data} == {"Plan A", "Plan B"}

    def test_deleted_plan_does_not_appear(
        self, client, test_session_factory, owner_user, recipient_user, recipient_auth_headers
    ):
        """FR5: if the owner deletes the plan, it drops out of the recipient's list too."""
        plan_id = _make_plan(test_session_factory, owner_user["id"], "Doomed Plan")

        share_repo = PlanShareRepositoryImpl(test_session_factory())
        CreateOrUnrevokeShare(share_repo).execute(plan_id)
        AddShareGrant(share_repo).execute(plan_id, recipient_user["id"], "view", owner_user["id"])

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert len(resp.json()) == 1

        session = test_session_factory()
        plan = session.get(WorkoutPlanModel, plan_id)
        session.delete(plan)  # cascades to plan_shares -> plan_share_grants
        session.commit()
        session.close()

        resp = client.get("/api/shared-with-me", headers=recipient_auth_headers)
        assert resp.json() == []
