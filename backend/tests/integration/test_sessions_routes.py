"""Integration tests for sessions routes.

Phase 7c: Tests for workout session endpoints (start, quick-start, add set, finish, discard, etc.).
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
from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel


@pytest.fixture(scope="function")
def test_engine(tmp_path):
    """Create a test engine with all tables."""
    db_file = tmp_path / "test_sessions.db"
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
def test_user(test_session_factory):
    """Create and return a test user."""
    session = test_session_factory()
    user = UserModel(
        id=1,
        username="testuser",
        display_name="Test User",
        password_hash="fake_hash",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return {"id": user_id, "username": "testuser"}


@pytest.fixture
def auth_headers(test_user):
    """Create auth headers for test user."""
    token = create_access_token(test_user["id"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_plan_and_day(test_session_factory, test_user):
    """Create a test workout plan and day."""
    session = test_session_factory()
    plan = WorkoutPlanModel(
        user_id=test_user["id"],
        name="Test Plan",
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
    session.close()

    return {"plan_id": plan_id, "day_id": day_id}


@pytest.fixture
def test_exercise_and_workout_exercise(test_session_factory, test_user, test_plan_and_day):
    """Create a test exercise and workout exercise."""
    session = test_session_factory()
    exercise = ExerciseModel(
        user_id=test_user["id"],
        name="Bench Press",
    )
    session.add(exercise)
    session.commit()
    exercise_id = exercise.id

    wo_exercise = WorkoutExerciseModel(
        plan_day_id=test_plan_and_day["day_id"],
        exercise_id=exercise_id,
        order_number=1,
    )
    session.add(wo_exercise)
    session.commit()
    wo_exercise_id = wo_exercise.id
    session.close()

    return {"exercise_id": exercise_id, "wo_exercise_id": wo_exercise_id}


# ============================================================================
# Start Workout Tests
# ============================================================================


class TestStartWorkoutRoute:
    """Tests for POST /api/workout-sessions endpoint."""

    def test_start_workout_success(self, client, auth_headers, test_plan_and_day):
        """POST /workout-sessions starts a new session."""
        response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["message"] == "Workout started"

    def test_start_workout_without_auth_fails(self, client, test_plan_and_day):
        """POST /workout-sessions without auth returns 401."""
        response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
        )
        assert response.status_code == 401


# ============================================================================
# Quick Start Workout Tests
# ============================================================================


class TestQuickStartWorkoutRoute:
    """Tests for POST /api/workout-sessions/quick-start endpoint."""

    def test_quick_start_success(self, client, auth_headers):
        """POST /workout-sessions/quick-start creates session."""
        response = client.post(
            "/api/workout-sessions/quick-start",
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["message"] == "Quick workout started"

    def test_quick_start_without_auth_fails(self, client):
        """POST /workout-sessions/quick-start without auth returns 401."""
        response = client.post("/api/workout-sessions/quick-start")
        assert response.status_code == 401


# ============================================================================
# Get Unresolved Session Tests
# ============================================================================


class TestGetUnresolvedSessionRoute:
    """Tests for GET /api/workout-sessions/unresolved endpoint."""

    def test_get_unresolved_no_session(self, client, auth_headers):
        """GET /workout-sessions/unresolved with no unresolved session returns null."""
        response = client.get(
            "/api/workout-sessions/unresolved",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session"] is None

    def test_get_unresolved_with_active_session(self, client, auth_headers, test_plan_and_day):
        """GET /workout-sessions/unresolved returns active session."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        assert start_response.status_code == 201

        # Get unresolved session
        response = client.get(
            "/api/workout-sessions/unresolved",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session"] is not None
        assert "id" in data["session"]
        assert data["session"]["plan_name"] == "Test Plan"


# ============================================================================
# Get Last Active Plan Tests
# ============================================================================


class TestGetLastActivePlanRoute:
    """Tests for GET /api/workout-sessions/last-active-plan endpoint."""

    def test_get_last_active_plan_no_sessions(self, client, auth_headers):
        """GET /workout-sessions/last-active-plan with no finished sessions returns null."""
        response = client.get(
            "/api/workout-sessions/last-active-plan",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is None

    def test_get_last_active_plan_returns_most_recent_finished_session(
        self, client, auth_headers, test_plan_and_day
    ):
        """GET /workout-sessions/last-active-plan returns the most recently finished session's plan/day."""
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        finish_response = client.put(
            f"/api/workout-sessions/{session_id}/finish",
            headers=auth_headers,
        )
        assert finish_response.status_code == 200

        response = client.get(
            "/api/workout-sessions/last-active-plan",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is not None
        assert data["plan"]["workout_plan_id"] == test_plan_and_day["plan_id"]
        assert data["plan"]["plan_name"] == "Test Plan"
        assert data["plan"]["day_label"] == "Day 1"
        assert data["plan"]["session_id"] == session_id

    def test_get_last_active_plan_ignores_unresolved_session(
        self, client, auth_headers, test_plan_and_day
    ):
        """An in-progress (unfinished) session must not appear here — only finished ones."""
        client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )

        response = client.get(
            "/api/workout-sessions/last-active-plan",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is None

    def test_get_last_active_plan_includes_quick_start_plans(
        self, client, auth_headers
    ):
        """Quick-start plans qualify too — no plan-type distinction for this endpoint."""
        start_response = client.post(
            "/api/workout-sessions/quick-start",
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        client.put(
            f"/api/workout-sessions/{session_id}/finish",
            headers=auth_headers,
        )

        response = client.get(
            "/api/workout-sessions/last-active-plan",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is not None
        assert data["plan"]["session_id"] == session_id

    def test_get_last_active_plan_without_auth_fails(self, client):
        """GET /workout-sessions/last-active-plan without auth returns 401."""
        response = client.get("/api/workout-sessions/last-active-plan")
        assert response.status_code == 401

    def test_get_last_active_plan_skips_deleted_plan(
        self, client, auth_headers, test_session_factory, test_user
    ):
        """A finished session on a since-deleted plan must never surface here —
        it falls back to the next most recent session on a plan that still exists.

        Deleting a plan sets workout_sessions.workout_plan_id to NULL in production
        (see migration change_fks_to_set_null_001 — ON DELETE SET NULL, chosen
        specifically to preserve logged history after a plan/exercise is deleted).
        Simulated directly here since the test schema (built from the SQLAlchemy
        models' bare `ForeignKey(...)` declarations, no explicit ondelete) doesn't
        carry that DB-level behavior the way the real Postgres schema does.
        """
        session = test_session_factory()
        old_plan = WorkoutPlanModel(user_id=test_user["id"], name="Old Plan")
        session.add(old_plan)
        session.commit()
        old_day = PlanDayModel(workout_plan_id=old_plan.id, order_position=1, label="Day 1")
        session.add(old_day)
        session.commit()
        old_plan_id, old_day_id = old_plan.id, old_day.id
        session.close()

        old_start = client.post(
            "/api/workout-sessions",
            json={"workout_plan_id": old_plan_id, "plan_day_id": old_day_id},
            headers=auth_headers,
        )
        client.put(f"/api/workout-sessions/{old_start.json()['session_id']}/finish", headers=auth_headers)

        session = test_session_factory()
        new_plan = WorkoutPlanModel(user_id=test_user["id"], name="New Plan")
        session.add(new_plan)
        session.commit()
        new_day = PlanDayModel(workout_plan_id=new_plan.id, order_position=1, label="Day 1")
        session.add(new_day)
        session.commit()
        new_plan_id, new_day_id = new_plan.id, new_day.id
        session.close()

        new_start = client.post(
            "/api/workout-sessions",
            json={"workout_plan_id": new_plan_id, "plan_day_id": new_day_id},
            headers=auth_headers,
        )
        new_session_id = new_start.json()["session_id"]
        client.put(f"/api/workout-sessions/{new_session_id}/finish", headers=auth_headers)

        # Simulate deleting the more recent plan: ON DELETE SET NULL detaches its
        # session (the use case under test only looks at session.workout_plan_id,
        # so it doesn't matter whether the plan row itself is also removed).
        session = test_session_factory()
        session.query(WorkoutSessionModel).filter_by(id=new_session_id).update(
            {"workout_plan_id": None}
        )
        session.commit()
        session.close()

        response = client.get("/api/workout-sessions/last-active-plan", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is not None
        assert data["plan"]["workout_plan_id"] == old_plan_id
        assert data["plan"]["plan_name"] == "Old Plan"

    def test_get_last_active_plan_returns_null_if_only_plan_ever_touched_was_deleted(
        self, client, auth_headers, test_session_factory, test_plan_and_day
    ):
        """If the user's only finished session was on a plan that's since been deleted,
        there's nothing to continue — the card must fall back to the empty state."""
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]
        client.put(f"/api/workout-sessions/{session_id}/finish", headers=auth_headers)

        session = test_session_factory()
        session.query(WorkoutSessionModel).filter_by(id=session_id).update({"workout_plan_id": None})
        session.commit()
        session.close()

        response = client.get("/api/workout-sessions/last-active-plan", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["plan"] is None


# ============================================================================
# Get Session Detail Tests
# ============================================================================


class TestGetSessionDetailRoute:
    """Tests for GET /api/workout-sessions/{id} endpoint."""

    def test_get_session_detail_success(self, client, auth_headers, test_plan_and_day):
        """GET /workout-sessions/{id} returns session details."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Get session detail
        response = client.get(
            f"/api/workout-sessions/{session_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session"]["id"] == session_id
        assert data["session"]["plan_name"] == "Test Plan"
        assert data["session"]["day_label"] == "Day 1"
        assert isinstance(data["sets"], list)


# ============================================================================
# Add Workout Set Tests
# ============================================================================


class TestAddWorkoutSetRoute:
    """Tests for POST /api/workout-sessions/{id}/sets endpoint."""

    def test_add_set_success(self, client, auth_headers, test_plan_and_day, test_exercise_and_workout_exercise):
        """POST /workout-sessions/{id}/sets adds a set."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Add a set
        response = client.post(
            f"/api/workout-sessions/{session_id}/sets",
            json={
                "workout_exercise_id": test_exercise_and_workout_exercise["wo_exercise_id"],
                "set_number": 1,
                "weight": 185.0,
                "reps": 10,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["set_number"] == 1
        assert data["weight"] == 185.0
        assert data["reps"] == 10

    def test_add_set_nonexistent_workout_exercise_returns_404_not_500(
        self, client, auth_headers, test_plan_and_day
    ):
        """A nonexistent workout_exercise_id must return a proper 404, not fall
        through to the generic 500 handler (regression test — this use case used
        to raise a bare ValueError, which no handler in app.py catches)."""
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        response = client.post(
            f"/api/workout-sessions/{session_id}/sets",
            json={
                "workout_exercise_id": 999999,
                "set_number": 1,
                "weight": 185.0,
                "reps": 10,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert response.json()["error"] == "Workout exercise not found"


# ============================================================================
# Finish Workout Tests
# ============================================================================


class TestFinishWorkoutRoute:
    """Tests for PUT /api/workout-sessions/{id}/finish endpoint."""

    def test_finish_workout_success(self, client, auth_headers, test_plan_and_day):
        """PUT /workout-sessions/{id}/finish completes session."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Finish workout
        response = client.put(
            f"/api/workout-sessions/{session_id}/finish",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Workout completed"

        # Verify session is now finished
        detail_response = client.get(
            f"/api/workout-sessions/{session_id}",
            headers=auth_headers,
        )
        assert detail_response.json()["session"]["completed_at"] is not None


# ============================================================================
# Discard Workout Session Tests
# ============================================================================


class TestDiscardWorkoutSessionRoute:
    """Tests for DELETE /api/workout-sessions/{id} endpoint."""

    def test_discard_session_success(self, client, auth_headers, test_plan_and_day):
        """DELETE /workout-sessions/{id} discards session."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Discard session
        response = client.delete(
            f"/api/workout-sessions/{session_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify session is deleted (should return 404)
        detail_response = client.get(
            f"/api/workout-sessions/{session_id}",
            headers=auth_headers,
        )
        assert detail_response.status_code == 404


# ============================================================================
# Delete Workout Set Tests
# ============================================================================


class TestDeleteWorkoutSetRoute:
    """Tests for DELETE /api/workout-sessions/{id}/sets/{set_id} endpoint."""

    def test_delete_set_success(self, client, auth_headers, test_plan_and_day, test_exercise_and_workout_exercise):
        """DELETE /workout-sessions/{id}/sets/{set_id} deletes a set."""
        # Start a workout
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Add a set
        set_response = client.post(
            f"/api/workout-sessions/{session_id}/sets",
            json={
                "workout_exercise_id": test_exercise_and_workout_exercise["wo_exercise_id"],
                "set_number": 1,
                "weight": 185.0,
                "reps": 10,
            },
            headers=auth_headers,
        )
        set_id = set_response.json()["id"]

        # Delete the set
        response = client.delete(
            f"/api/workout-sessions/{session_id}/sets/{set_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify set is deleted (session should have no sets)
        detail_response = client.get(
            f"/api/workout-sessions/{session_id}",
            headers=auth_headers,
        )
        assert len(detail_response.json()["sets"]) == 0


# ============================================================================
# Active Workout Bootstrap Tests (Task 83)
# ============================================================================


class TestActiveWorkoutBootstrapRoute:
    """Tests for GET /api/workout-sessions/{id}/bootstrap endpoint."""

    def test_bootstrap_success(
        self, client, auth_headers, test_plan_and_day, test_exercise_and_workout_exercise
    ):
        """GET /workout-sessions/{id}/bootstrap returns session, plan, and exercises in one call."""
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        response = client.get(
            f"/api/workout-sessions/{session_id}/bootstrap",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Session
        assert data["session"]["session"]["id"] == session_id
        assert data["session"]["session"]["plan_name"] == "Test Plan"
        assert isinstance(data["session"]["sets"], list)

        # Plan
        assert data["plan"] is not None
        assert data["plan"]["plan"]["id"] == test_plan_and_day["plan_id"]

        # Exercises
        assert isinstance(data["exercises"], list)
        assert any(e["id"] == test_exercise_and_workout_exercise["exercise_id"] for e in data["exercises"])

    def test_bootstrap_returns_null_plan_for_deleted_plan(
        self, client, auth_headers, test_plan_and_day, test_session_factory
    ):
        """GET /workout-sessions/{id}/bootstrap returns plan: null (not an error) when the
        session's workout_plan_id is null — the state a session ends up in per the Task 74
        SET NULL fix once its plan is deleted.

        NOTE: this simulates that end state directly via the DB rather than going through
        DELETE /workout-plans/{id}, because the SQLAlchemy *model* FKs on WorkoutSessionModel
        (workout_plan_id/plan_day_id/plan_week_id) were never updated to declare
        ondelete='SET NULL' after the Task 74 migration applied it directly to the real
        database — so a fresh SQLite test DB built from these models still enforces the old
        blocking FK behavior and a real cascade-delete-through-the-API fails here with an
        IntegrityError. That's a genuine, separate gap (model/migration drift), out of scope
        for this task — flagged in the completion report, not fixed here.
        """
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        # Simulate the post-plan-deletion state directly (see NOTE above)
        db = test_session_factory()
        from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel

        session_model = db.query(WorkoutSessionModel).filter(WorkoutSessionModel.id == session_id).first()
        session_model.workout_plan_id = None
        session_model.plan_day_id = None
        db.commit()
        db.close()

        response = client.get(
            f"/api/workout-sessions/{session_id}/bootstrap",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] is None
        assert data["session"]["session"]["workout_plan_id"] is None
        # Exercises should still load fine even with no plan
        assert isinstance(data["exercises"], list)

    def test_bootstrap_without_auth_fails(self, client, test_plan_and_day):
        """GET /workout-sessions/{id}/bootstrap without auth returns 401."""
        response = client.get("/api/workout-sessions/1/bootstrap")
        assert response.status_code == 401

    def test_bootstrap_nonexistent_session_fails(self, client, auth_headers):
        """GET /workout-sessions/{id}/bootstrap for a session that doesn't exist returns an error, not a 500."""
        response = client.get(
            "/api/workout-sessions/999999/bootstrap",
            headers=auth_headers,
        )
        assert response.status_code in (404, 400)


# ============================================================================
# Dashboard Summary Tests
# ============================================================================


class TestGetDashboardSummaryRoute:
    """Tests for GET /api/dashboard/summary endpoint."""

    def test_summary_for_a_brand_new_user_is_all_zeros_and_nulls(self, client, auth_headers):
        """A user with no history yet gets a clean empty state, never an error."""
        response = client.get("/api/dashboard/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["weekly_stats"] == {"workout_count": 0, "total_volume": 0, "pr_count": 0}
        assert len(data["weekly_activity"]) == 7
        assert all(not day["has_workout"] for day in data["weekly_activity"])
        assert data["random_exercise"] is None

    def test_summary_reflects_a_finished_workout_logged_today(
        self, client, auth_headers, test_plan_and_day, test_exercise_and_workout_exercise
    ):
        start_response = client.post(
            "/api/workout-sessions",
            json={
                "workout_plan_id": test_plan_and_day["plan_id"],
                "plan_day_id": test_plan_and_day["day_id"],
            },
            headers=auth_headers,
        )
        session_id = start_response.json()["session_id"]

        client.post(
            f"/api/workout-sessions/{session_id}/sets",
            json={
                "workout_exercise_id": test_exercise_and_workout_exercise["wo_exercise_id"],
                "set_number": 1,
                "weight": 100.0,
                "reps": 10,
            },
            headers=auth_headers,
        )
        client.put(f"/api/workout-sessions/{session_id}/finish", headers=auth_headers)

        response = client.get("/api/dashboard/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["weekly_stats"]["workout_count"] == 1
        assert data["weekly_stats"]["total_volume"] == 1000
        # First-ever set for this exercise is never a PR.
        assert data["weekly_stats"]["pr_count"] == 0

        active_days = [d for d in data["weekly_activity"] if d["has_workout"]]
        assert len(active_days) == 1
        assert active_days[0]["session_id"] == session_id

        assert data["random_exercise"] is not None
        assert data["random_exercise"]["exercise_id"] == test_exercise_and_workout_exercise["exercise_id"]

    def test_summary_without_auth_fails(self, client):
        """GET /api/dashboard/summary without auth returns 401."""
        response = client.get("/api/dashboard/summary")
        assert response.status_code == 401
