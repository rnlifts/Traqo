"""Integration tests for the plan-sharing data layer (step 1 of the sharing feature).

Covers the PlanShareRepositoryImpl CRUD surface, soft revocation, grant upsert
semantics, and the new workout_sessions attribution columns round-tripping.
"""

from datetime import datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database import Base
from src.infrastructure.security.share_token_service import generate_share_token
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.sharing.domain.entities.plan_share import (
    PlanShare,
    PlanShareGrant,
    SHARE_MODE_ANYONE,
    permission_at_least,
)
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)
from src.modules.sessions.domain.entities.workout_session import WorkoutSession
from src.modules.sessions.infrastructure.repositories.workout_session_repository_impl import (
    WorkoutSessionRepositoryImpl,
)


@pytest.fixture
def db_session(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test_shares.db'}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def owner_and_plan(db_session):
    owner = UserModel(username="shareowner", display_name="Owner", password_hash="x")
    recipient = UserModel(username="sharerecipient", display_name="Recipient", password_hash="x")
    db_session.add_all([owner, recipient])
    db_session.commit()

    plan = WorkoutPlanModel(user_id=owner.id, name="Shared Plan")
    db_session.add(plan)
    db_session.commit()

    return {"owner_id": owner.id, "recipient_id": recipient.id, "plan_id": plan.id}


class TestPermissionOrdering:
    def test_tiers_are_ordered_view_log_edit(self):
        assert permission_at_least("edit", "view")
        assert permission_at_least("edit", "log")
        assert permission_at_least("log", "view")
        assert not permission_at_least("view", "log")
        assert not permission_at_least("log", "edit")
        assert not permission_at_least("bogus", "view")


class TestPlanShareRepository:
    def test_create_and_lookup_by_token_and_plan(self, db_session, owner_and_plan):
        repo = PlanShareRepositoryImpl(db_session)
        token = generate_share_token()
        created = repo.create(PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=token))

        assert created.id is not None
        assert created.is_active

        by_token = repo.get_by_token(token)
        assert by_token is not None and by_token.id == created.id

        by_plan = repo.get_by_plan(owner_and_plan["plan_id"])
        assert by_plan is not None and by_plan.id == created.id

        assert repo.get_by_token("nonexistent-token") is None

    def test_soft_revoke_keeps_row(self, db_session, owner_and_plan):
        repo = PlanShareRepositoryImpl(db_session)
        share = repo.create(
            PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=generate_share_token())
        )

        share.revoked_at = datetime.utcnow()
        updated = repo.update(share)

        assert not updated.is_active
        # Row still exists and is still findable — revocation must never delete.
        assert repo.get_by_token(share.token) is not None

    def test_update_mode_and_link_permission(self, db_session, owner_and_plan):
        repo = PlanShareRepositoryImpl(db_session)
        share = repo.create(
            PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=generate_share_token())
        )
        assert share.mode == "restricted"
        assert share.link_permission == "view"

        share.mode = SHARE_MODE_ANYONE
        share.link_permission = "edit"
        updated = repo.update(share)
        assert updated.mode == SHARE_MODE_ANYONE
        assert updated.link_permission == "edit"

    def test_grants_add_list_get_remove(self, db_session, owner_and_plan):
        repo = PlanShareRepositoryImpl(db_session)
        share = repo.create(
            PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=generate_share_token())
        )
        rid = owner_and_plan["recipient_id"]

        grant = repo.add_grant(PlanShareGrant(plan_share_id=share.id, user_id=rid, permission="log"))
        assert grant.id is not None

        assert [g.user_id for g in repo.list_grants(share.id)] == [rid]
        assert repo.get_grant_for_user(share.id, rid).permission == "log"
        assert repo.get_grant_for_user(share.id, 999999) is None

        repo.remove_grant(share.id, rid)
        assert repo.list_grants(share.id) == []
        repo.remove_grant(share.id, rid)  # no-op, must not raise

    def test_add_grant_upserts_permission_for_same_user(self, db_session, owner_and_plan):
        repo = PlanShareRepositoryImpl(db_session)
        share = repo.create(
            PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=generate_share_token())
        )
        rid = owner_and_plan["recipient_id"]

        repo.add_grant(PlanShareGrant(plan_share_id=share.id, user_id=rid, permission="view"))
        repo.add_grant(PlanShareGrant(plan_share_id=share.id, user_id=rid, permission="edit"))

        grants = repo.list_grants(share.id)
        assert len(grants) == 1
        assert grants[0].permission == "edit"


class TestSessionAttributionColumns:
    def test_session_round_trips_share_attribution(self, db_session, owner_and_plan):
        share_repo = PlanShareRepositoryImpl(db_session)
        share = share_repo.create(
            PlanShare(workout_plan_id=owner_and_plan["plan_id"], token=generate_share_token())
        )

        session_repo = WorkoutSessionRepositoryImpl(db_session)
        created = session_repo.create(
            WorkoutSession(
                user_id=owner_and_plan["owner_id"],
                workout_plan_id=owner_and_plan["plan_id"],
                started_at=datetime.utcnow(),
                share_id=share.id,
                logged_by_user_id=owner_and_plan["recipient_id"],
            )
        )

        fetched = session_repo.get_by_id(created.id)
        assert fetched.share_id == share.id
        assert fetched.logged_by_user_id == owner_and_plan["recipient_id"]

    def test_ordinary_session_defaults_to_null_attribution(self, db_session, owner_and_plan):
        session_repo = WorkoutSessionRepositoryImpl(db_session)
        created = session_repo.create(
            WorkoutSession(
                user_id=owner_and_plan["owner_id"],
                workout_plan_id=owner_and_plan["plan_id"],
                started_at=datetime.utcnow(),
            )
        )
        fetched = session_repo.get_by_id(created.id)
        assert fetched.share_id is None
        assert fetched.logged_by_user_id is None

    def test_share_tokens_are_unique_and_long(self):
        tokens = {generate_share_token() for _ in range(50)}
        assert len(tokens) == 50
        assert all(len(t) >= 40 for t in tokens)
