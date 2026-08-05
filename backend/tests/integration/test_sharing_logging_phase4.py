"""Integration tests for shared-plan logging endpoints (Phase 4).

Tests the logging-through-share endpoints:
- POST /api/shared/{token}/start (start workout via share)
- POST /api/shared/{token}/sessions/{session_id}/sets (add set via share)
- POST /api/shared/{token}/sessions/{session_id}/finish (finish via share)
And stats-exclusion rules in GetWorkoutHistory and GetExerciseProgress.
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
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)
from src.modules.sharing.application.use_cases.create_or_unrevoke_share import (
    CreateOrUnrevokeShare,
)
from src.modules.sharing.application.use_cases.update_share import UpdateShare


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_sharing_phase4.db"
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
def recipient_user(test_session_factory):
    """Create and return a recipient user (will be granted access)."""
    session = test_session_factory()
    user = UserModel(
        username="recipient",
        display_name="Recipient User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "recipient"}


@pytest.fixture
def owner_auth_headers(owner_user):
    """Create auth headers for owner_user."""
    token = create_access_token(owner_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def recipient_auth_headers(recipient_user):
    """Create auth headers for recipient_user."""
    token = create_access_token(recipient_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def owner_plan_with_exercise(test_session_factory, owner_user):
    """Create a test plan owned by owner_user with an exercise."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=owner_user["id"],
        name="Test Plan",
        unit_type="days",
    )
    session.add(plan)
    session.commit()
    plan_id = plan.id

    day = PlanDayModel(
        workout_plan_id=plan_id,
        order_position=1,
        label="Day 1",
    )
    session.add(day)
    session.commit()
    day_id = day.id

    exercise = ExerciseModel(
        user_id=owner_user["id"],
        name="Bench Press",
    )
    session.add(exercise)
    session.commit()
    exercise_id = exercise.id

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
        "plan_id": plan_id,
        "day_id": day_id,
        "exercise_id": exercise_id,
        "wo_exercise_id": wo_exercise_id,
    }


@pytest.fixture
def share_log_permission_anyone(test_session_factory, owner_plan_with_exercise):
    """Create an 'anyone' mode share with 'log' permission."""
    session = test_session_factory()
    share_repo = PlanShareRepositoryImpl(session)
    use_case = CreateOrUnrevokeShare(share_repo)
    share = use_case.execute(owner_plan_with_exercise["plan_id"])

    # Update to 'anyone' mode with 'log' permission
    update_use_case = UpdateShare(share_repo)
    share = update_use_case.execute(
        owner_plan_with_exercise["plan_id"],
        mode="anyone",
        link_permission="log",
    )
    session.close()
    return {"token": share.token, "share_id": share.id}


@pytest.fixture
def share_view_permission_anyone(test_session_factory, owner_plan_with_exercise):
    """Create an 'anyone' mode share with 'view' permission (no logging)."""
    session = test_session_factory()
    share_repo = PlanShareRepositoryImpl(session)
    use_case = CreateOrUnrevokeShare(share_repo)
    share = use_case.execute(owner_plan_with_exercise["plan_id"])

    # Update to 'anyone' mode with 'view' permission
    update_use_case = UpdateShare(share_repo)
    share = update_use_case.execute(
        owner_plan_with_exercise["plan_id"],
        mode="anyone",
        link_permission="view",
    )
    session.close()
    return {"token": share.token, "share_id": share.id}


class TestStartWorkoutViaShare:
    """Tests for POST /api/shared/{token}/start."""

    def test_authenticated_recipient_starts_via_share(
        self, client, owner_plan_with_exercise, share_log_permission_anyone, recipient_auth_headers, recipient_user
    ):
        """Authenticated recipient with 'log' permission starts via share."""
        resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "session_id" in data
        assert data["message"] == "Workout started via share"

        # Verify session has correct attribution
        session_id = data["session_id"]
        resp = client.get(
            f"/api/workout-sessions/{session_id}",
            headers=recipient_auth_headers,
        )
        assert resp.status_code == 200
        session_data = resp.json()
        # Session belongs to recipient
        assert session_data["session"]["user_id"] == recipient_user["id"]

    def test_authenticated_view_only_cannot_start(
        self, client, owner_plan_with_exercise, share_view_permission_anyone, recipient_auth_headers
    ):
        """Authenticated user with only 'view' permission cannot start via share."""
        resp = client.post(
            f"/api/shared/{share_view_permission_anyone['token']}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert resp.status_code == 403

    def test_anonymous_starts_via_anyone_log_share(
        self, client, owner_plan_with_exercise, owner_user, share_log_permission_anyone
    ):
        """Anonymous user with 'anyone' mode + 'log' permission starts via share."""
        resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "session_id" in data
        session_id = data["session_id"]

        # Verify session belongs to owner (owner has the session)
        # We can't directly check via normal endpoint since anonymous has no auth,
        # but we can verify through database in integration test
        # For now, just verify the session was created
        assert session_id is not None

    def test_anonymous_cannot_start_view_only_share(
        self, client, owner_plan_with_exercise, share_view_permission_anyone
    ):
        """Anonymous user cannot start with 'view'-only permission."""
        resp = client.post(
            f"/api/shared/{share_view_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert resp.status_code == 403

    def test_start_via_nonexistent_share_returns_404(
        self, client, owner_plan_with_exercise, recipient_auth_headers
    ):
        """POST /shared/{bad_token}/start returns 404."""
        resp = client.post(
            "/api/shared/nonexistent_token_12345/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert resp.status_code == 404


class TestAddSetViaShare:
    """Tests for POST /api/shared/{token}/sessions/{session_id}/sets."""

    def test_anonymous_adds_set_via_share(
        self, client, owner_plan_with_exercise, owner_user, share_log_permission_anyone, test_session_factory
    ):
        """Anonymous user adds a set via share token-scoped endpoint."""
        # Start session as anonymous
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert start_resp.status_code == 201
        session_id = start_resp.json()["session_id"]

        # Add a set
        set_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
                "notes": "Felt strong",
            },
        )
        assert set_resp.status_code == 201
        set_data = set_resp.json()
        assert "set_id" in set_data
        assert "set_number" in set_data
        assert set_data["set_number"] == 1

    def test_add_set_wrong_share_returns_403(
        self, client, owner_plan_with_exercise, owner_user, test_session_factory, recipient_auth_headers
    ):
        """Adding set with wrong share token returns 403.

        Since there can only be one share per plan, we test by creating two plans
        and verifying that a session from plan A cannot accept sets via plan B's share.
        """
        # Create second plan and share
        session = test_session_factory()
        plan2 = WorkoutPlanModel(
            user_id=owner_user["id"],
            name="Second Plan",
            unit_type="days",
        )
        session.add(plan2)
        session.commit()
        plan2_id = plan2.id

        day2 = PlanDayModel(
            workout_plan_id=plan2_id,
            order_position=1,
            label="Day 1",
        )
        session.add(day2)
        session.commit()
        day2_id = day2.id

        exercise = ExerciseModel(
            user_id=owner_user["id"],
            name="Squat",
        )
        session.add(exercise)
        session.commit()
        exercise2_id = exercise.id

        wo_exercise = WorkoutExerciseModel(
            plan_day_id=day2_id,
            exercise_id=exercise2_id,
            order_number=1,
        )
        session.add(wo_exercise)
        session.commit()
        session.close()

        # Create share for plan 2
        share_repo = PlanShareRepositoryImpl(test_session_factory())
        use_case = CreateOrUnrevokeShare(share_repo)
        share2 = use_case.execute(plan2_id)
        update_use_case = UpdateShare(share_repo)
        share2 = update_use_case.execute(plan2_id, mode="anyone", link_permission="log")

        # Create share for plan 1
        share_repo1 = PlanShareRepositoryImpl(test_session_factory())
        use_case1 = CreateOrUnrevokeShare(share_repo1)
        share1 = use_case1.execute(owner_plan_with_exercise["plan_id"])
        update_use_case1 = UpdateShare(share_repo1)
        share1 = update_use_case1.execute(
            owner_plan_with_exercise["plan_id"], mode="anyone", link_permission="log"
        )

        # Start session with share1
        start_resp = client.post(
            f"/api/shared/{share1.token}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Try to add set with share2 token (different share)
        set_resp = client.post(
            f"/api/shared/{share2.token}/sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "exercise_id": exercise2_id,
                "weight": 225.0,
                "reps": 5,
            },
        )
        assert set_resp.status_code == 403
        # Verify it's the right error
        resp_data = set_resp.json()
        assert "does not belong to this share" in resp_data.get("detail", str(resp_data))

    def test_add_set_nonexistent_session_returns_404(
        self, client, share_log_permission_anyone
    ):
        """Adding set to nonexistent session returns 404."""
        resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/9999/sets",
            json={
                "exercise_id": 1,
                "weight": 225.0,
                "reps": 5,
            },
        )
        assert resp.status_code == 404

    def test_add_multiple_sets_increments_set_number(
        self, client, owner_plan_with_exercise, share_log_permission_anyone
    ):
        """Adding multiple sets increments the set_number correctly."""
        # Start session
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Add first set
        set_resp1 = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
            },
        )
        assert set_resp1.status_code == 201
        assert set_resp1.json()["set_number"] == 1

        # Add second set
        set_resp2 = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 3,
            },
        )
        assert set_resp2.status_code == 201
        assert set_resp2.json()["set_number"] == 2

    def test_authenticated_recipient_adds_set_via_share(
        self, client, owner_plan_with_exercise, share_log_permission_anyone, recipient_auth_headers, recipient_user, test_session_factory
    ):
        """Authenticated recipient with 'log' permission adds a set against owner's exercise via share.

        This is the primary sharing use case (trainer's client logging sets against trainer's exercise).
        Tests the exact regression scenario: recipient logs a set through a share where the exercise
        belongs to the plan owner, not the recipient.
        """
        # Start session as authenticated recipient
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        assert start_resp.status_code == 201
        session_id = start_resp.json()["session_id"]

        # Add a set as recipient (should succeed with the fix, fails without)
        set_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
                "notes": "Felt good",
            },
        )
        assert set_resp.status_code == 201, f"Expected 201, got {set_resp.status_code}: {set_resp.json()}"
        set_data = set_resp.json()
        assert "set_id" in set_data
        assert set_data["set_number"] == 1

        # Negative-control: verify the set's exercise_id matches
        # and the session still belongs to the recipient, not reassigned to owner
        session = test_session_factory()
        from src.modules.sessions.infrastructure.models.workout_set_model import WorkoutSetModel
        from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel

        set_model = session.query(WorkoutSetModel).filter_by(id=set_data["set_id"]).first()
        session_model = session.query(WorkoutSessionModel).filter_by(id=session_id).first()
        session.close()

        assert set_model is not None
        assert set_model.exercise_id == owner_plan_with_exercise["exercise_id"]
        assert session_model is not None
        assert session_model.user_id == recipient_user["id"], "Session ownership should not be reassigned"

    def test_authenticated_recipient_multiple_sets_via_share(
        self, client, owner_plan_with_exercise, share_log_permission_anyone, recipient_auth_headers
    ):
        """Authenticated recipient adds multiple sets via share (set_number increments correctly)."""
        # Start session
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Add first set
        set_resp1 = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
            },
        )
        assert set_resp1.status_code == 201
        assert set_resp1.json()["set_number"] == 1

        # Add second set
        set_resp2 = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 3,
            },
        )
        assert set_resp2.status_code == 201
        assert set_resp2.json()["set_number"] == 2

    def test_normal_endpoint_enforces_exercise_ownership(
        self, client, test_session_factory, recipient_user, recipient_auth_headers, owner_user
    ):
        """Verify the normal (non-share) endpoint still enforces exercise ownership.

        User cannot log a set against an exercise they don't own via the normal endpoint.
        This is a negative-control test to ensure the fix doesn't weaken non-share paths.
        """
        # Create a plan owned by recipient_user
        session = test_session_factory()
        plan = WorkoutPlanModel(
            user_id=recipient_user["id"],
            name="Recipient Plan",
            unit_type="days",
        )
        session.add(plan)
        session.commit()
        plan_id = plan.id

        day = PlanDayModel(
            workout_plan_id=plan_id,
            order_position=1,
            label="Day 1",
        )
        session.add(day)
        session.commit()
        day_id = day.id

        # Create an exercise owned by owner_user (different from recipient)
        exercise = ExerciseModel(
            user_id=owner_user["id"],
            name="Owner's Exercise",
        )
        session.add(exercise)
        session.commit()
        exercise_id = exercise.id

        # Add exercise to recipient's plan day
        wo_exercise = WorkoutExerciseModel(
            plan_day_id=day_id,
            exercise_id=exercise_id,
            order_number=1,
        )
        session.add(wo_exercise)
        session.commit()
        wo_exercise_id = wo_exercise.id
        session.close()

        # Start a workout as recipient_user using their own plan
        start_resp = client.post(
            "/api/workout-sessions",
            headers=recipient_auth_headers,
            json={
                "workout_plan_id": plan_id,
                "plan_day_id": day_id,
            },
        )
        assert start_resp.status_code == 201
        session_id = start_resp.json()["session_id"]

        # Try to add a set against the owner's exercise via the normal endpoint
        # This should FAIL because recipient doesn't own the exercise
        set_resp = client.post(
            f"/api/workout-sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "workout_exercise_id": wo_exercise_id,
                "set_number": 1,
                "weight": 185.0,
                "reps": 10,
            },
        )
        assert set_resp.status_code == 403, f"Expected 403, got {set_resp.status_code}: {set_resp.json()}"
        error_msg = set_resp.json().get("detail", set_resp.json().get("error", "")).lower()
        assert "own" in error_msg and "exercise" in error_msg


class TestFinishWorkoutViaShare:
    """Tests for POST /api/shared/{token}/sessions/{session_id}/finish."""

    def test_anonymous_finishes_workout_via_share(
        self, client, owner_plan_with_exercise, share_log_permission_anyone
    ):
        """Anonymous user finishes a workout via share token-scoped endpoint."""
        # Start session
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Finish session
        finish_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/finish",
        )
        assert finish_resp.status_code == 200
        assert finish_resp.json()["message"] == "Workout completed"

    def test_finish_nonexistent_session_returns_404(
        self, client, share_log_permission_anyone
    ):
        """Finishing nonexistent session returns 404."""
        resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/9999/finish",
        )
        assert resp.status_code == 404


class TestStatsExclusionRule:
    """Tests for stats-exclusion rule in GetWorkoutHistory and GetExerciseProgress."""

    def test_owner_history_excludes_anonymous_logged_sessions(
        self, client, owner_user, owner_auth_headers, owner_plan_with_exercise, share_log_permission_anyone
    ):
        """Owner's history excludes sessions logged by anonymous via share."""
        # Anonymous logs a session
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Add a set
        client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
            },
        )

        # Finish the session
        client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/finish",
        )

        # Owner's history should NOT include this session
        history_resp = client.get(
            "/api/workout-history",
            headers=owner_auth_headers,
        )
        assert history_resp.status_code == 200
        history = history_resp.json()
        # Should be empty since anonymous-logged session should be excluded
        assert len(history) == 0

    def test_recipient_history_includes_own_share_logged_sessions(
        self, client, owner_plan_with_exercise, owner_user, share_log_permission_anyone, recipient_auth_headers, recipient_user
    ):
        """Recipient's history includes their own share-logged sessions."""
        # Recipient logs a session via share
        start_resp = client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/start",
            headers=recipient_auth_headers,
            json={
                "plan_day_id": owner_plan_with_exercise["day_id"],
            },
        )
        session_id = start_resp.json()["session_id"]

        # Add a set
        client.post(
            f"/api/shared/{share_log_permission_anyone['token']}/sessions/{session_id}/sets",
            headers=recipient_auth_headers,
            json={
                "exercise_id": owner_plan_with_exercise["exercise_id"],
                "weight": 225.0,
                "reps": 5,
            },
        )

        # Finish the session via normal endpoint (recipient owns it)
        client.put(
            f"/api/workout-sessions/{session_id}/finish",
            headers=recipient_auth_headers,
        )

        # Recipient's history should include this session
        history_resp = client.get(
            "/api/workout-history",
            headers=recipient_auth_headers,
        )
        assert history_resp.status_code == 200
        history = history_resp.json()
        assert len(history) == 1
        assert history[0]["session_id"] == session_id
