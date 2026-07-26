"""Unit tests for get_exercise_progress.py — per-exercise progress tracking.

Tests the core logic: Epley e1RM calculation, independent PR flags for weight/reps/e1rm/volume,
and the critical behavior that a user's first-ever logged set is never flagged as a PR.
"""

from datetime import datetime, timedelta
import pytest

from src.modules.sessions.application.use_cases.get_exercise_progress import (
    GetExerciseProgress,
)
from src.modules.sessions.domain.entities.workout_set import WorkoutSet
from src.modules.sessions.domain.entities.workout_session import WorkoutSession
from src.modules.exercises.domain.entities.exercise import Exercise
from src.modules.exercises.domain.exceptions import (
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)


# ============================================================================
# In-Memory Test Doubles
# ============================================================================


class InMemoryWorkoutSessionRepository:
    """In-memory implementation for testing."""

    def __init__(self):
        self.sessions = {}
        self.next_id = 1

    def create(self, session: WorkoutSession) -> WorkoutSession:
        session_id = self.next_id
        self.next_id += 1
        session.id = session_id
        self.sessions[session_id] = session
        return session

    def get_by_id(self, session_id: int) -> WorkoutSession | None:
        return self.sessions.get(session_id)

    def update(self, session: WorkoutSession) -> WorkoutSession:
        self.sessions[session.id] = session
        return session

    def list_finished_by_user(self, user_id: int) -> list[WorkoutSession]:
        return [s for s in self.sessions.values() if s.user_id == user_id and s.completed_at]

    def exists_for_plan(self, plan_id: int) -> bool:
        return any(s.workout_plan_id == plan_id for s in self.sessions.values())

    def exists_for_day(self, day_id: int) -> bool:
        return any(s.plan_day_id == day_id for s in self.sessions.values())

    def get_most_recent_finished_for_day(
        self, day_id: int, exclude_session_id: int | None = None
    ) -> "WorkoutSession | None":
        finished = [
            s for s in self.sessions.values()
            if s.plan_day_id == day_id and s.completed_at
            and (exclude_session_id is None or s.id != exclude_session_id)
        ]
        return max(finished, key=lambda s: s.started_at) if finished else None


class InMemoryWorkoutSetRepository:
    """In-memory implementation for testing."""

    def __init__(self):
        self.sets = {}
        self.next_id = 1

    def create(self, workout_set: WorkoutSet) -> WorkoutSet:
        set_id = self.next_id
        self.next_id += 1
        workout_set.id = set_id
        self.sets[set_id] = workout_set
        return workout_set

    def get_by_id(self, set_id: int) -> WorkoutSet | None:
        return self.sets.get(set_id)

    def get_by_session_exercise_and_set_number(
        self, session_id: int, exercise_id: int, set_number: int
    ) -> WorkoutSet | None:
        for s in self.sets.values():
            if (
                s.workout_session_id == session_id
                and s.exercise_id == exercise_id
                and s.set_number == set_number
            ):
                return s
        return None

    def update(self, workout_set: WorkoutSet) -> WorkoutSet:
        self.sets[workout_set.id] = workout_set
        return workout_set

    def list_by_session(self, session_id: int) -> list[WorkoutSet]:
        return [s for s in self.sets.values() if s.workout_session_id == session_id]

    def count_by_session_and_exercise(self, session_id: int, exercise_id: int) -> int:
        return sum(
            1 for s in self.sets.values()
            if s.workout_session_id == session_id and s.exercise_id == exercise_id
        )

    def delete(self, set_id: int) -> None:
        if set_id in self.sets:
            del self.sets[set_id]

    def list_finished_by_user_and_exercise(
        self, user_id: int, exercise_id: int
    ) -> list[WorkoutSet]:
        """Get all finished sets for a user and exercise, chronologically ordered."""
        result = []
        for s in self.sets.values():
            session = getattr(s, '_session_ref', None)
            if session and session.user_id == user_id and s.exercise_id == exercise_id and session.completed_at:
                result.append(s)
        # Sort by session start time, then set number
        result.sort(key=lambda s: (s._session_ref.started_at, s.set_number))
        return result


class InMemoryExerciseRepository:
    """In-memory implementation for testing."""

    def __init__(self):
        self.exercises = {}
        self.next_id = 1

    def create(self, exercise: Exercise) -> Exercise:
        ex_id = self.next_id
        self.next_id += 1
        exercise.id = ex_id
        self.exercises[ex_id] = exercise
        return exercise

    def list_by_user(self, user_id: int) -> list[Exercise]:
        return [e for e in self.exercises.values() if e.user_id == user_id]

    def get_by_id(self, exercise_id: int) -> Exercise | None:
        return self.exercises.get(exercise_id)

    def delete(self, exercise_id: int) -> None:
        if exercise_id in self.exercises:
            del self.exercises[exercise_id]

    def is_used_in_any_plan(self, exercise_id: int) -> bool:
        return False


# ============================================================================
# Tests
# ============================================================================


class TestGetExerciseProgressFirstSetNeverPR:
    """Test that a user's first-ever set for an exercise is never flagged as PR."""

    def test_single_set_no_pr_flags(self):
        """A user's very first set for an exercise has all PR flags false."""
        # Setup
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Bench Press")
        exercise_repo.create(exercise)

        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=datetime.now(),
            completed_at=datetime.now() + timedelta(minutes=30),
        )
        session = session_repo.create(session)

        # First ever set for this exercise
        first_set = WorkoutSet(
            workout_session_id=session.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=135.0,
            reps=8,
            notes="",
        )
        first_set = set_repo.create(first_set)
        first_set._session_ref = session  # For test double lookup

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)

        # Execute
        result = use_case.execute(user_id, exercise_id)

        # Assert
        assert len(result.sessions) == 1
        session_entry = result.sessions[0]
        assert len(session_entry.sets) == 1
        progress_set = session_entry.sets[0]

        # First-ever set should never be flagged as PR
        assert progress_set.is_weight_pr is False
        assert progress_set.is_reps_pr is False
        assert progress_set.is_e1rm_pr is False

        # But personal_records should have the value
        assert result.personal_records.heaviest_weight == 135.0
        assert result.personal_records.most_reps == 8


class TestGetExerciseProgressEpleyFormula:
    """Test Epley e1RM calculation: weight × (1 + reps / 30)."""

    def test_epley_calculation(self):
        """Test the Epley formula is calculated correctly."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Squat")
        exercise_repo.create(exercise)

        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=datetime.now(),
            completed_at=datetime.now() + timedelta(minutes=30),
        )
        session = session_repo.create(session)

        # Set: 225 lbs × 5 reps
        # Expected e1RM = 225 × (1 + 5/30) = 225 × 1.1667 ≈ 262.5
        test_set = WorkoutSet(
            workout_session_id=session.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=225.0,
            reps=5,
            notes="",
        )
        test_set = set_repo.create(test_set)
        test_set._session_ref = session

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        progress_set = result.sessions[0].sets[0]
        expected_e1rm = 225.0 * (1 + 5 / 30)
        expected_e1rm = round(expected_e1rm, 1)

        assert progress_set.estimated_1rm == expected_e1rm
        assert progress_set.estimated_1rm == 262.5

    def test_epley_high_reps(self):
        """Test Epley with high reps (e.g., 20 reps × 100 lbs)."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Leg Press")
        exercise_repo.create(exercise)

        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=datetime.now(),
            completed_at=datetime.now() + timedelta(minutes=30),
        )
        session = session_repo.create(session)

        # 100 lbs × 20 reps
        # e1RM = 100 × (1 + 20/30) = 100 × 1.667 ≈ 166.7
        test_set = WorkoutSet(
            workout_session_id=session.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=100.0,
            reps=20,
            notes="",
        )
        test_set = set_repo.create(test_set)
        test_set._session_ref = session

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        progress_set = result.sessions[0].sets[0]
        expected_e1rm = round(100.0 * (1 + 20 / 30), 1)

        assert progress_set.estimated_1rm == expected_e1rm
        assert progress_set.estimated_1rm == 166.7


class TestGetExerciseProgressIndependentPRCategories:
    """Test that PR flags are independent: weight/reps/e1rm/volume track separately."""

    def test_higher_reps_without_weight_pr(self):
        """A higher-rep set at lower weight is a reps PR but not a weight PR."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Bench Press")
        exercise_repo.create(exercise)

        # Session 1: 225 lbs × 5 reps
        now = datetime.now()
        session1 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now,
            completed_at=now + timedelta(minutes=30),
        )
        session1 = session_repo.create(session1)

        set1 = WorkoutSet(
            workout_session_id=session1.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=225.0,
            reps=5,
            notes="",
        )
        set1 = set_repo.create(set1)
        set1._session_ref = session1

        # Session 2: 185 lbs × 10 reps (lower weight, more reps)
        session2 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now + timedelta(days=3),
            completed_at=now + timedelta(days=3, minutes=30),
        )
        session2 = session_repo.create(session2)

        set2 = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=185.0,
            reps=10,
            notes="",
        )
        set2 = set_repo.create(set2)
        set2._session_ref = session2

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        # Session 2's set should be:
        # - NOT a weight PR (185 < 225)
        # - IS a reps PR (10 > 5)
        session2_set = result.sessions[1].sets[0]
        assert session2_set.is_weight_pr is False
        assert session2_set.is_reps_pr is True

    def test_higher_weight_without_reps_pr(self):
        """A higher-weight set at lower reps is a weight PR but not a reps PR."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Deadlift")
        exercise_repo.create(exercise)

        now = datetime.now()

        # Session 1: 315 lbs × 5 reps
        session1 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now,
            completed_at=now + timedelta(minutes=30),
        )
        session1 = session_repo.create(session1)

        set1 = WorkoutSet(
            workout_session_id=session1.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=315.0,
            reps=5,
            notes="",
        )
        set1 = set_repo.create(set1)
        set1._session_ref = session1

        # Session 2: 335 lbs × 3 reps (higher weight, fewer reps)
        session2 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now + timedelta(days=3),
            completed_at=now + timedelta(days=3, minutes=30),
        )
        session2 = session_repo.create(session2)

        set2 = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=335.0,
            reps=3,
            notes="",
        )
        set2 = set_repo.create(set2)
        set2._session_ref = session2

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        session2_set = result.sessions[1].sets[0]
        assert session2_set.is_weight_pr is True
        assert session2_set.is_reps_pr is False

    def test_volume_pr_independent_of_weight_and_reps_pr(self):
        """A session can be a volume PR without all individual sets being PRs.

        This test demonstrates a realistic scenario: many lighter-weight,
        higher-rep sets accumulate to higher total volume, achieving a volume PR
        while individual weight values stay lower.
        """
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Leg Press")
        exercise_repo.create(exercise)

        now = datetime.now()

        # Session 1: Single heavy set, 400 × 3 reps (volume = 1200, weight = 400)
        session1 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now,
            completed_at=now + timedelta(minutes=30),
        )
        session1 = session_repo.create(session1)

        set1 = WorkoutSet(
            workout_session_id=session1.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=400.0,
            reps=3,
            notes="",
        )
        set1 = set_repo.create(set1)
        set1._session_ref = session1

        # Session 2: Multiple lighter-weight high-rep sets, 200 × 10, 200 × 9, 200 × 8
        # (volume = 2000 + 1800 + 1600 = 5400, weight per set = 200)
        session2 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now + timedelta(days=3),
            completed_at=now + timedelta(days=3, minutes=30),
        )
        session2 = session_repo.create(session2)

        set2a = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=200.0,
            reps=10,
            notes="",
        )
        set2a = set_repo.create(set2a)
        set2a._session_ref = session2

        set2b = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=2,
            weight=200.0,
            reps=9,
            notes="",
        )
        set2b = set_repo.create(set2b)
        set2b._session_ref = session2

        set2c = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=3,
            weight=200.0,
            reps=8,
            notes="",
        )
        set2c = set_repo.create(set2c)
        set2c._session_ref = session2

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        # Session 2 should have much higher volume (5400 > 1200)
        session2_entry = result.sessions[1]
        expected_volume = 200.0 * 10 + 200.0 * 9 + 200.0 * 8
        assert session2_entry.volume == expected_volume
        assert session2_entry.is_volume_pr is True

        # But no individual sets in session 2 should be weight PRs (200 < 400)
        for s in session2_entry.sets:
            assert s.is_weight_pr is False


class TestGetExerciseProgressMultipleSessions:
    """Test correct progression across multiple sessions."""

    def test_three_sessions_progressive_weight(self):
        """Three sessions with increasing weight: second & third are weight PRs."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Bench Press")
        exercise_repo.create(exercise)

        now = datetime.now()

        # Session 1: 185 lbs × 5
        session1 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now,
            completed_at=now + timedelta(minutes=30),
        )
        session1 = session_repo.create(session1)

        set1 = WorkoutSet(
            workout_session_id=session1.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=185.0,
            reps=5,
            notes="",
        )
        set1 = set_repo.create(set1)
        set1._session_ref = session1

        # Session 2: 205 lbs × 5
        session2 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now + timedelta(days=3),
            completed_at=now + timedelta(days=3, minutes=30),
        )
        session2 = session_repo.create(session2)

        set2 = WorkoutSet(
            workout_session_id=session2.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=205.0,
            reps=5,
            notes="",
        )
        set2 = set_repo.create(set2)
        set2._session_ref = session2

        # Session 3: 225 lbs × 5
        session3 = WorkoutSession(
            user_id=user_id,
            workout_plan_id=1,
            plan_day_id=1,
            started_at=now + timedelta(days=6),
            completed_at=now + timedelta(days=6, minutes=30),
        )
        session3 = session_repo.create(session3)

        set3 = WorkoutSet(
            workout_session_id=session3.id,
            exercise_id=exercise_id,
            set_number=1,
            weight=225.0,
            reps=5,
            notes="",
        )
        set3 = set_repo.create(set3)
        set3._session_ref = session3

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        # Session 1: no PR
        assert result.sessions[0].sets[0].is_weight_pr is False

        # Session 2: weight PR
        assert result.sessions[1].sets[0].is_weight_pr is True

        # Session 3: weight PR
        assert result.sessions[2].sets[0].is_weight_pr is True

        # Personal records
        assert result.personal_records.heaviest_weight == 225.0
        assert result.personal_records.heaviest_weight_date == session3.started_at


class TestGetExerciseProgressErrors:
    """Test error cases."""

    def test_exercise_not_found_raises_error(self):
        """Requesting progress for a non-existent exercise raises ExerciseNotFoundError."""
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)

        with pytest.raises(ExerciseNotFoundError):
            use_case.execute(user_id=1, exercise_id=999)

    def test_unauthorized_access_raises_error(self):
        """Requesting progress for an exercise owned by another user raises error."""
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        # Create exercise owned by user 2
        exercise = Exercise(user_id=2, name="Squat")
        exercise_repo.create(exercise)

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)

        # User 1 tries to access it
        with pytest.raises(UnauthorizedExerciseAccessError):
            use_case.execute(user_id=1, exercise_id=exercise.id)


class TestGetExerciseProgressEmptyCase:
    """Test behavior with no sessions/sets."""

    def test_no_sets_returns_empty_entries(self):
        """An exercise with no logged sets returns empty sessions list."""
        user_id = 1
        exercise_id = 1
        session_repo = InMemoryWorkoutSessionRepository()
        set_repo = InMemoryWorkoutSetRepository()
        exercise_repo = InMemoryExerciseRepository()

        exercise = Exercise(user_id=user_id, name="Bench Press")
        exercise_repo.create(exercise)

        use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
        result = use_case.execute(user_id, exercise_id)

        assert result.exercise_id == exercise_id
        assert result.exercise_name == "Bench Press"
        assert result.sessions == []
        assert result.personal_records.heaviest_weight is None
        assert result.personal_records.best_estimated_1rm is None
        assert result.personal_records.best_volume is None
        assert result.personal_records.most_reps is None
