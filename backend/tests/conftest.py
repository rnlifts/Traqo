"""Shared test fixtures and configuration."""

import os
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.infrastructure.database import Base
from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.entities.workout_exercise import WorkoutExercise
from src.modules.workouts.domain.entities.plan_day import PlanDay
from src.modules.workouts.domain.entities.plan_week import PlanWeek
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.workouts.domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from src.modules.workouts.domain.interfaces.plan_day_repository import PlanDayRepository
from src.modules.workouts.domain.interfaces.plan_week_repository import PlanWeekRepository
from src.modules.exercises.domain.entities.exercise import Exercise
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository
from src.modules.sessions.domain.entities.workout_session import WorkoutSession
from src.modules.sessions.domain.entities.workout_set import WorkoutSet
from src.modules.sessions.domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.sessions.domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercise_library.domain.entities.exercise_library_item import ExerciseLibraryItem
from src.modules.exercise_library.domain.interfaces.exercise_library_repository import ExerciseLibraryRepository
from src.modules.auth.domain.entities.user import User
from src.modules.auth.domain.interfaces.user_repository import UserRepository


# ============================================================================
# In-Memory Repository Doubles (Auth)
# ============================================================================


class InMemoryUserRepository(UserRepository):
    """In-memory implementation of UserRepository for testing."""

    def __init__(self):
        self.users = {}
        self.next_id = 1

    def get_by_username(self, username: str) -> User | None:
        for user in self.users.values():
            if user.username.lower() == username.lower():
                return user
        return None

    def save(self, user: User) -> User:
        if user.id is None:
            user.id = self.next_id
            self.next_id += 1
        self.users[user.id] = user
        return user

    def exists_by_username(self, username: str) -> bool:
        return self.get_by_username(username) is not None


# ============================================================================
# Rate Limiter Reset (for integration tests)
# ============================================================================


# ============================================================================
# Test Database (SQLite in-memory)
# ============================================================================


@pytest.fixture(scope="function")
def test_db():
    """Provide an in-memory SQLite test database."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)

    TestSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSessionLocal()

    yield session

    session.close()
    engine.dispose()


@pytest.fixture(scope="function")
def test_db_session(test_db):
    """Alias for test_db for convenience."""
    return test_db


# ============================================================================
# In-Memory Repository Doubles (for unit tests)
# ============================================================================


class InMemoryWorkoutPlanRepository(WorkoutPlanRepository):
    """In-memory implementation of WorkoutPlanRepository for testing."""

    def __init__(self):
        self.plans = {}
        self.next_id = 1

    def create(self, plan: WorkoutPlan) -> WorkoutPlan:
        plan_id = self.next_id
        self.next_id += 1
        plan.id = plan_id
        self.plans[plan_id] = plan
        return plan

    def list_by_user(self, user_id: int) -> list[WorkoutPlan]:
        return [p for p in self.plans.values() if p.user_id == user_id]

    def get_by_id(self, plan_id: int) -> WorkoutPlan | None:
        return self.plans.get(plan_id)

    def update(self, plan: WorkoutPlan) -> WorkoutPlan:
        self.plans[plan.id] = plan
        return plan

    def delete(self, plan_id: int) -> None:
        if plan_id in self.plans:
            del self.plans[plan_id]


class InMemoryWorkoutExerciseRepository(WorkoutExerciseRepository):
    """In-memory implementation of WorkoutExerciseRepository for testing."""

    def __init__(self):
        self.exercises = {}
        self.next_id = 1

    def add(self, workout_exercise: WorkoutExercise) -> WorkoutExercise:
        ex_id = self.next_id
        self.next_id += 1
        workout_exercise.id = ex_id
        self.exercises[ex_id] = workout_exercise
        return workout_exercise

    def list_by_plan(self, plan_id: int) -> list[WorkoutExercise]:
        exercises = [e for e in self.exercises.values() if e.workout_plan_id == plan_id]
        return sorted(exercises, key=lambda e: e.order_number)

    def list_by_day(self, day_id: int) -> list[WorkoutExercise]:
        """Get all exercises for a specific plan day, ordered by order_number."""
        exercises = [e for e in self.exercises.values() if e.plan_day_id == day_id]
        return sorted(exercises, key=lambda e: e.order_number)

    def get_by_id(self, workout_exercise_id: int) -> WorkoutExercise | None:
        return self.exercises.get(workout_exercise_id)

    def remove(self, workout_exercise_id: int) -> None:
        if workout_exercise_id in self.exercises:
            del self.exercises[workout_exercise_id]

    def update(self, workout_exercise: WorkoutExercise) -> WorkoutExercise:
        """Update an existing workout_exercise with all its fields."""
        if workout_exercise.id not in self.exercises:
            return None
        self.exercises[workout_exercise.id] = workout_exercise
        return workout_exercise

    def update_order(self, workout_exercise_id: int, new_order_number: int) -> WorkoutExercise:
        if workout_exercise_id in self.exercises:
            self.exercises[workout_exercise_id].order_number = new_order_number
            return self.exercises[workout_exercise_id]
        return None


class InMemoryExerciseRepository(ExerciseRepository):
    """In-memory implementation of ExerciseRepository for testing."""

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

    def exists_by_user_and_name(self, user_id: int, name: str) -> bool:
        return any(
            e.user_id == user_id and e.name.lower() == name.lower()
            for e in self.exercises.values()
        )


# ============================================================================
# Repository Fixtures
# ============================================================================


@pytest.fixture
def in_memory_plan_repo():
    """Provide an in-memory WorkoutPlanRepository."""
    return InMemoryWorkoutPlanRepository()


@pytest.fixture
def in_memory_workout_exercise_repo():
    """Provide an in-memory WorkoutExerciseRepository."""
    return InMemoryWorkoutExerciseRepository()


@pytest.fixture
def in_memory_exercise_repo():
    """Provide an in-memory ExerciseRepository."""
    return InMemoryExerciseRepository()


# ============================================================================
# Test Data Fixtures
# ============================================================================


@pytest.fixture
def user_id():
    """Provide a test user ID."""
    return 1


@pytest.fixture
def another_user_id():
    """Provide another test user ID."""
    return 2


@pytest.fixture
def sample_plan(in_memory_plan_repo, user_id):
    """Create and return a sample WorkoutPlan."""
    plan = WorkoutPlan(user_id=user_id, name="Test Plan")
    return in_memory_plan_repo.create(plan)


@pytest.fixture
def sample_exercise(in_memory_exercise_repo, user_id):
    """Create and return a sample Exercise."""
    exercise = Exercise(user_id=user_id, name="Bench Press")
    return in_memory_exercise_repo.create(exercise)


@pytest.fixture
def another_user_exercise(in_memory_exercise_repo, another_user_id):
    """Create and return an exercise owned by another user."""
    exercise = Exercise(user_id=another_user_id, name="Deadlift")
    return in_memory_exercise_repo.create(exercise)


# ============================================================================
# Additional In-Memory Repository Doubles (Sessions, Plan Days/Weeks, Exercise Library)
# ============================================================================


class InMemoryWorkoutSessionRepository(WorkoutSessionRepository):
    """In-memory implementation of WorkoutSessionRepository for testing."""

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
        finished = [
            s for s in self.sessions.values()
            if s.user_id == user_id and s.completed_at is not None
        ]
        return sorted(finished, key=lambda s: s.started_at, reverse=True)

    def exists_for_plan(self, plan_id: int) -> bool:
        return any(s.workout_plan_id == plan_id for s in self.sessions.values())

    def exists_for_day(self, day_id: int) -> bool:
        return any(s.plan_day_id == day_id for s in self.sessions.values())

    def get_most_recent_finished_for_day(
        self, day_id: int, exclude_session_id: int | None = None
    ) -> WorkoutSession | None:
        finished = [
            s for s in self.sessions.values()
            if s.plan_day_id == day_id and s.completed_at is not None
            and (exclude_session_id is None or s.id != exclude_session_id)
        ]
        if not finished:
            return None
        return max(finished, key=lambda s: s.started_at)

    def find_unresolved_by_user(self, user_id: int) -> WorkoutSession | None:
        unresolved = [
            s for s in self.sessions.values()
            if s.user_id == user_id and s.completed_at is None
        ]
        if not unresolved:
            return None
        return max(unresolved, key=lambda s: s.started_at)

    def delete(self, session_id: int) -> None:
        if session_id in self.sessions:
            del self.sessions[session_id]


class InMemoryWorkoutSetRepository(WorkoutSetRepository):
    """In-memory implementation of WorkoutSetRepository for testing."""

    def __init__(self, session_repository=None):
        self.sets = {}
        self.next_id = 1
        self.session_repository = session_repository  # For list_finished_by_user_and_exercise

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
        return sorted(
            [s for s in self.sets.values() if s.session_id == session_id],
            key=lambda s: (s.exercise_id, s.set_number)
        )

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
        """Get all sets for an exercise from finished sessions, chronologically."""
        if not self.session_repository:
            return []

        # Get all finished sessions for this user
        finished_sessions = self.session_repository.list_finished_by_user(user_id)
        finished_session_ids = {s.id for s in finished_sessions}

        # Filter sets: must be in a finished session AND match the exercise
        matching_sets = [
            s for s in self.sets.values()
            if s.workout_session_id in finished_session_ids and s.exercise_id == exercise_id
        ]

        # Sort chronologically by session started_at, then by set_number
        def sort_key(s):
            session = self.session_repository.get_by_id(s.workout_session_id)
            return (session.started_at if session else datetime.max, s.set_number)

        return sorted(matching_sets, key=sort_key)


class InMemoryPlanDayRepository(PlanDayRepository):
    """In-memory implementation of PlanDayRepository for testing."""

    def __init__(self):
        self.days = {}
        self.next_id = 1

    def create(self, plan_day: PlanDay) -> PlanDay:
        day_id = self.next_id
        self.next_id += 1
        plan_day.id = day_id
        self.days[day_id] = plan_day
        return plan_day

    def get_by_id(self, day_id: int) -> PlanDay | None:
        return self.days.get(day_id)

    def list_by_plan(self, plan_id: int) -> list[PlanDay]:
        days = [d for d in self.days.values() if d.workout_plan_id == plan_id]
        return sorted(days, key=lambda d: d.order_position)

    def update(self, plan_day: PlanDay) -> PlanDay:
        self.days[plan_day.id] = plan_day
        return plan_day

    def delete(self, day_id: int) -> None:
        if day_id in self.days:
            del self.days[day_id]


class InMemoryPlanWeekRepository(PlanWeekRepository):
    """In-memory implementation of PlanWeekRepository for testing."""

    def __init__(self):
        self.weeks = {}
        self.next_id = 1

    def create(self, plan_week: PlanWeek) -> PlanWeek:
        week_id = self.next_id
        self.next_id += 1
        plan_week.id = week_id
        self.weeks[week_id] = plan_week
        return plan_week

    def get_by_id(self, week_id: int) -> PlanWeek | None:
        return self.weeks.get(week_id)

    def list_by_plan(self, plan_id: int) -> list[PlanWeek]:
        weeks = [w for w in self.weeks.values() if w.workout_plan_id == plan_id]
        return sorted(weeks, key=lambda w: w.week_number)

    def update(self, plan_week: PlanWeek) -> PlanWeek:
        self.weeks[plan_week.id] = plan_week
        return plan_week

    def delete(self, week_id: int) -> None:
        if week_id in self.weeks:
            del self.weeks[week_id]

    def get_by_plan_and_week_number(self, plan_id: int, week_number: int) -> PlanWeek | None:
        for w in self.weeks.values():
            if w.workout_plan_id == plan_id and w.week_number == week_number:
                return w
        return None


class InMemoryExerciseLibraryItemRepository(ExerciseLibraryRepository):
    """In-memory implementation of ExerciseLibraryRepository for testing."""

    def __init__(self):
        self.items = {}
        self.next_id = 1

    def search(
        self, muscle_group: str | None = None
    ) -> list[ExerciseLibraryItem]:
        items = list(self.items.values())
        if muscle_group:
            items = [i for i in items if i.muscle_group == muscle_group]
        return sorted(items, key=lambda i: i.name)

    def get_distinct_muscle_groups(self) -> list[str]:
        groups = set(i.muscle_group for i in self.items.values())
        return sorted(list(groups))

    def get_distinct_equipment(self) -> list[str]:
        equipment = set(i.equipment for i in self.items.values() if i.equipment is not None)
        return sorted(list(equipment))

    def upsert(self, item: ExerciseLibraryItem) -> ExerciseLibraryItem:
        # Find by (name, muscle_group)
        for existing in self.items.values():
            if existing.name == item.name and existing.muscle_group == item.muscle_group:
                # Update existing
                existing.equipment = item.equipment
                existing.video_url = item.video_url
                existing.image_url = item.image_url
                return existing

        # Insert new
        item_id = self.next_id
        self.next_id += 1
        item.id = item_id
        self.items[item_id] = item
        return item


# ============================================================================
# Additional Repository Fixtures
# ============================================================================


@pytest.fixture
def in_memory_session_repo():
    """Provide an in-memory WorkoutSessionRepository."""
    return InMemoryWorkoutSessionRepository()


@pytest.fixture
def in_memory_set_repo(in_memory_session_repo):
    """Provide an in-memory WorkoutSetRepository with session access."""
    return InMemoryWorkoutSetRepository(session_repository=in_memory_session_repo)


@pytest.fixture
def in_memory_day_repo():
    """Provide an in-memory PlanDayRepository."""
    return InMemoryPlanDayRepository()


@pytest.fixture
def in_memory_week_repo():
    """Provide an in-memory PlanWeekRepository."""
    return InMemoryPlanWeekRepository()


@pytest.fixture
def in_memory_exercise_library_repo():
    """Provide an in-memory ExerciseLibraryRepository."""
    return InMemoryExerciseLibraryItemRepository()


@pytest.fixture
def in_memory_user_repo():
    """Provide an in-memory UserRepository."""
    return InMemoryUserRepository()
