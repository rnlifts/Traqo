"""Unit tests for sessions module.

Phase 6: Session lifecycle, set management, progress tracking with Epley 1RM.
Tests cover StartWorkout, QuickStartWorkout, AddWorkoutSet, FinishWorkout,
DiscardWorkoutSession, GetExerciseProgress, and guard conditions.
"""

from datetime import datetime, timezone
import pytest
from src.modules.sessions.domain.entities.workout_session import WorkoutSession
from src.modules.sessions.domain.entities.workout_set import WorkoutSet
from src.modules.sessions.domain.exceptions import (
    UnresolvedSessionExistsError,
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
    InvalidSetDataError,
)
from src.modules.sessions.application.use_cases.start_workout import StartWorkout
from src.modules.sessions.application.use_cases.quick_start_workout import QuickStartWorkout
from src.modules.sessions.application.use_cases.add_workout_set import AddWorkoutSet
from src.modules.sessions.application.use_cases.finish_workout import FinishWorkout
from src.modules.sessions.application.use_cases.discard_workout_session import DiscardWorkoutSession
from src.modules.sessions.application.use_cases.get_exercise_progress import GetExerciseProgress
from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.entities.plan_day import PlanDay
from src.modules.exercises.domain.entities.exercise import Exercise
from src.modules.workouts.domain.entities.workout_exercise import WorkoutExercise


def now_utc():
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


@pytest.fixture
def user_id():
    """Provide a test user ID."""
    return 1


@pytest.fixture
def other_user_id():
    """Provide a different user ID."""
    return 2


# ============================================================================
# StartWorkout Tests
# ============================================================================


class TestStartWorkout:
    """Tests for StartWorkout use case."""

    def test_start_workout_creates_session(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """StartWorkout creates a new session from a plan."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        use_case = StartWorkout(in_memory_plan_repo, in_memory_session_repo)
        session = use_case.execute(user_id, plan.id, day.id)

        assert session.id is not None
        assert session.user_id == user_id
        assert session.workout_plan_id == plan.id
        assert session.plan_day_id == day.id
        assert session.started_at is not None
        assert session.completed_at is None

    def test_start_workout_unresolved_session_blocks_new_session(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """StartWorkout raises UnresolvedSessionExistsError if user has active session."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        # Create first session
        use_case = StartWorkout(in_memory_plan_repo, in_memory_session_repo)
        session1 = use_case.execute(user_id, plan.id, day.id)
        assert session1.id is not None

        # Attempt to start second session should fail
        with pytest.raises(UnresolvedSessionExistsError):
            use_case.execute(user_id, plan.id, day.id)

    def test_start_workout_after_completion_succeeds(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """After completing a session, user can start a new one."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        use_case = StartWorkout(in_memory_plan_repo, in_memory_session_repo)

        # First session
        session1 = use_case.execute(user_id, plan.id, day.id)
        assert session1.id is not None

        # Mark as completed
        session1.completed_at = now_utc()
        in_memory_session_repo.update(session1)

        # Second session should now succeed
        session2 = use_case.execute(user_id, plan.id, day.id)
        assert session2.id is not None
        assert session2.id != session1.id


# ============================================================================
# QuickStartWorkout Tests
# ============================================================================


class TestQuickStartWorkout:
    """Tests for QuickStartWorkout use case."""

    def test_quick_start_creates_session_with_plan_and_day(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """QuickStartWorkout creates plan, day, and session in one call."""
        use_case = QuickStartWorkout(
            in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo
        )

        session = use_case.execute(user_id)

        assert session.id is not None
        assert session.user_id == user_id
        assert session.workout_plan_id is not None
        assert session.plan_day_id is not None
        assert session.started_at is not None
        assert session.completed_at is None

        # Verify plan and day were created
        plan = in_memory_plan_repo.get_by_id(session.workout_plan_id)
        assert plan is not None
        assert plan.user_id == user_id
        assert "Quick Workout" in plan.name

        day = in_memory_day_repo.get_by_id(session.plan_day_id)
        assert day is not None
        assert day.label == "Day 1"

    def test_quick_start_blocks_if_unresolved_exists(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """QuickStartWorkout raises UnresolvedSessionExistsError if user has active session."""
        use_case = QuickStartWorkout(
            in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo
        )

        # Create first quick-start session
        session1 = use_case.execute(user_id)
        assert session1.id is not None

        # Attempt second quick-start should fail
        with pytest.raises(UnresolvedSessionExistsError):
            use_case.execute(user_id)


# ============================================================================
# AddWorkoutSet Tests
# ============================================================================


class TestAddWorkoutSet:
    """Tests for AddWorkoutSet use case."""

    def test_add_set_creates_new_set(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        in_memory_workout_exercise_repo,
        user_id,
    ):
        """AddWorkoutSet creates a new set for a session."""
        # Setup: create plan, day, session, exercise, workout exercise
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        wo_exercise = in_memory_workout_exercise_repo.add(
            WorkoutExercise(plan_day_id=day.id, exercise_id=exercise.id, order_number=1)
        )

        use_case = AddWorkoutSet(
            in_memory_session_repo,
            in_memory_set_repo,
            in_memory_exercise_repo,
            in_memory_workout_exercise_repo,
        )

        workout_set = use_case.execute(
            user_id, session.id, wo_exercise.id, set_number=1, weight=185.0, reps=10
        )

        assert workout_set.id is not None
        assert workout_set.workout_session_id == session.id
        assert workout_set.exercise_id == exercise.id
        assert workout_set.set_number == 1
        assert workout_set.weight == 185.0
        assert workout_set.reps == 10

    def test_add_set_upsert_overwrites_existing(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        in_memory_workout_exercise_repo,
        user_id,
    ):
        """AddWorkoutSet upserts: same (session, exercise, set_number) overwrites."""
        # Setup
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        wo_exercise = in_memory_workout_exercise_repo.add(
            WorkoutExercise(plan_day_id=day.id, exercise_id=exercise.id, order_number=1)
        )

        use_case = AddWorkoutSet(
            in_memory_session_repo,
            in_memory_set_repo,
            in_memory_exercise_repo,
            in_memory_workout_exercise_repo,
        )

        # First set
        set1 = use_case.execute(
            user_id, session.id, wo_exercise.id, set_number=1, weight=185.0, reps=10
        )
        set1_id = set1.id

        # Overwrite with second call to same (session, exercise, set_number)
        set2 = use_case.execute(
            user_id, session.id, wo_exercise.id, set_number=1, weight=190.0, reps=12
        )

        # Should be same ID (updated, not new)
        assert set2.id == set1_id
        assert set2.weight == 190.0
        assert set2.reps == 12

    def test_add_set_requires_at_least_one_value(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        in_memory_workout_exercise_repo,
        user_id,
    ):
        """AddWorkoutSet requires at least one of weight, reps, or duration."""
        # Setup
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        wo_exercise = in_memory_workout_exercise_repo.add(
            WorkoutExercise(plan_day_id=day.id, exercise_id=exercise.id, order_number=1)
        )

        use_case = AddWorkoutSet(
            in_memory_session_repo,
            in_memory_set_repo,
            in_memory_exercise_repo,
            in_memory_workout_exercise_repo,
        )

        # Try to add set with no values
        with pytest.raises(InvalidSetDataError):
            use_case.execute(user_id, session.id, wo_exercise.id, set_number=1)

    def test_add_set_to_finished_session_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        in_memory_workout_exercise_repo,
        user_id,
    ):
        """AddWorkoutSet raises error if session is already finished."""
        # Setup
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        wo_exercise = in_memory_workout_exercise_repo.add(
            WorkoutExercise(plan_day_id=day.id, exercise_id=exercise.id, order_number=1)
        )

        use_case = AddWorkoutSet(
            in_memory_session_repo,
            in_memory_set_repo,
            in_memory_exercise_repo,
            in_memory_workout_exercise_repo,
        )

        with pytest.raises(SessionAlreadyFinishedError):
            use_case.execute(
                user_id, session.id, wo_exercise.id, set_number=1, weight=185.0, reps=10
            )


# ============================================================================
# FinishWorkout Tests
# ============================================================================


class TestFinishWorkout:
    """Tests for FinishWorkout use case."""

    def test_finish_workout_marks_completed(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """FinishWorkout sets completed_at timestamp."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )

        use_case = FinishWorkout(in_memory_session_repo)
        use_case.execute(user_id, session.id)

        # Verify session is marked finished
        updated = in_memory_session_repo.get_by_id(session.id)
        assert updated.completed_at is not None
        assert updated.is_finished()

    def test_finish_workout_already_finished_raises_error(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """FinishWorkout raises error if session already finished."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )

        use_case = FinishWorkout(in_memory_session_repo)
        with pytest.raises(SessionAlreadyFinishedError):
            use_case.execute(user_id, session.id)

    def test_finish_workout_wrong_owner_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        user_id,
        other_user_id,
    ):
        """FinishWorkout raises error if user doesn't own session."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )

        use_case = FinishWorkout(in_memory_session_repo)
        with pytest.raises(UnauthorizedWorkoutSessionAccessError):
            use_case.execute(other_user_id, session.id)


# ============================================================================
# DiscardWorkoutSession Tests
# ============================================================================


class TestDiscardWorkoutSession:
    """Tests for DiscardWorkoutSession use case."""

    def test_discard_session_deletes_it(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """DiscardWorkoutSession deletes an unresolved session."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )
        session_id = session.id

        use_case = DiscardWorkoutSession(in_memory_session_repo)
        use_case.execute(user_id, session_id)

        # Verify session is deleted
        assert in_memory_session_repo.get_by_id(session_id) is None

    def test_discard_finished_session_raises_error(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """DiscardWorkoutSession raises error if session is already finished."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )

        use_case = DiscardWorkoutSession(in_memory_session_repo)
        with pytest.raises(SessionAlreadyFinishedError):
            use_case.execute(user_id, session.id)

    def test_discard_wrong_owner_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        user_id,
        other_user_id,
    ):
        """DiscardWorkoutSession raises error if user doesn't own session."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )

        use_case = DiscardWorkoutSession(in_memory_session_repo)
        with pytest.raises(UnauthorizedWorkoutSessionAccessError):
            use_case.execute(other_user_id, session.id)


# ============================================================================
# Session Repository Query Tests
# ============================================================================


class TestSessionRepositoryQueries:
    """Tests for session repository query methods."""

    def test_find_unresolved_returns_active_session(
        self, in_memory_plan_repo, in_memory_day_repo, in_memory_session_repo, user_id
    ):
        """Repository finds the active unresolved session."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        # Create finished session
        finished = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )

        # Create unresolved session (newer)
        active = in_memory_session_repo.create(
            WorkoutSession(user_id=user_id, workout_plan_id=plan.id, plan_day_id=day.id, started_at=now_utc())
        )

        unresolved = in_memory_session_repo.find_unresolved_by_user(user_id)

        assert unresolved is not None
        assert unresolved.id == active.id

    def test_find_unresolved_returns_none_if_none_exist(
        self, in_memory_session_repo, user_id
    ):
        """Repository returns None if user has no unresolved session."""
        unresolved = in_memory_session_repo.find_unresolved_by_user(user_id)
        assert unresolved is None


# ============================================================================
# GetExerciseProgress Tests (Epley 1RM and PR Detection)
# ============================================================================


class TestGetExerciseProgress:
    """Tests for GetExerciseProgress use case with Epley 1RM and PR detection."""

    def test_exercise_progress_calculates_epley_1rm(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        user_id,
    ):
        """GetExerciseProgress calculates Epley 1RM correctly: weight × (1 + reps/30)."""
        # Setup: create exercise, session, and set
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )
        session = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),  # Must be finished for progress calc
            )
        )

        # Create a set: 185 lbs × 10 reps = 1RM ~247.5
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=10,
            )
        )

        use_case = GetExerciseProgress(
            in_memory_session_repo, in_memory_set_repo, in_memory_exercise_repo
        )
        progress = use_case.execute(user_id, exercise.id)

        assert len(progress.sessions) == 1
        assert len(progress.sessions[0].sets) == 1
        set_data = progress.sessions[0].sets[0]
        assert set_data.estimated_1rm == pytest.approx(247.5, rel=0.01)

    def test_exercise_progress_detects_weight_pr(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        user_id,
    ):
        """GetExerciseProgress detects weight PR (personal record)."""
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        # First session: 185 lbs
        session1 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session1.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=10,
            )
        )

        # Second session: 190 lbs (should be weight PR)
        session2 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session2.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=190.0,
                reps=10,
            )
        )

        use_case = GetExerciseProgress(
            in_memory_session_repo, in_memory_set_repo, in_memory_exercise_repo
        )
        progress = use_case.execute(user_id, exercise.id)

        # Second session's set should be flagged as weight PR
        assert progress.sessions[1].sets[0].is_weight_pr is True
        # First session's set should not be PR (first data point)
        assert progress.sessions[0].sets[0].is_weight_pr is False

    def test_exercise_progress_detects_1rm_pr(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        user_id,
    ):
        """GetExerciseProgress detects 1RM PR (best estimated 1-rep max)."""
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        # First session: 185 lbs × 10 reps = ~247.5 1RM
        session1 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session1.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=10,
            )
        )

        # Second session: 200 lbs × 6 reps = ~240 1RM (not a 1RM PR despite higher weight)
        session2 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session2.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=200.0,
                reps=6,
            )
        )

        # Third session: 185 lbs × 12 reps = ~260 1RM (should be 1RM PR)
        session3 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session3.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=12,
            )
        )

        use_case = GetExerciseProgress(
            in_memory_session_repo, in_memory_set_repo, in_memory_exercise_repo
        )
        progress = use_case.execute(user_id, exercise.id)

        # Verify PR summary
        assert progress.personal_records.best_estimated_1rm == pytest.approx(260.0, rel=0.01)
        assert progress.personal_records.heaviest_weight == 200.0

    def test_exercise_progress_detects_volume_pr(
        self,
        in_memory_plan_repo,
        in_memory_day_repo,
        in_memory_session_repo,
        in_memory_set_repo,
        in_memory_exercise_repo,
        user_id,
    ):
        """GetExerciseProgress detects volume PR (weight × reps total)."""
        exercise = in_memory_exercise_repo.create(
            Exercise(user_id=user_id, name="Bench Press")
        )
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Push"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        # First session: 185 × 10 = 1850 volume
        session1 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session1.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=10,
            )
        )

        # Second session: 185 × 12 = 2220 volume (volume PR)
        session2 = in_memory_session_repo.create(
            WorkoutSession(
                user_id=user_id,
                workout_plan_id=plan.id,
                plan_day_id=day.id,
                started_at=now_utc(),
                completed_at=now_utc(),
            )
        )
        in_memory_set_repo.create(
            WorkoutSet(
                workout_session_id=session2.id,
                exercise_id=exercise.id,
                set_number=1,
                weight=185.0,
                reps=12,
            )
        )

        use_case = GetExerciseProgress(
            in_memory_session_repo, in_memory_set_repo, in_memory_exercise_repo
        )
        progress = use_case.execute(user_id, exercise.id)

        # Verify volume calculation and PR flag
        assert progress.sessions[0].volume == 1850.0
        assert progress.sessions[0].is_volume_pr is False  # First session, not a PR
        assert progress.sessions[1].volume == 2220.0
        assert progress.sessions[1].is_volume_pr is True  # Second session, is a PR
        assert progress.personal_records.best_volume == 2220.0
