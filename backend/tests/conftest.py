"""Shared test fixtures and configuration."""

import os
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.infrastructure.database import Base
from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.entities.workout_exercise import WorkoutExercise
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.workouts.domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from src.modules.exercises.domain.entities.exercise import Exercise
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


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

    def get_by_id(self, workout_exercise_id: int) -> WorkoutExercise | None:
        return self.exercises.get(workout_exercise_id)

    def remove(self, workout_exercise_id: int) -> None:
        if workout_exercise_id in self.exercises:
            del self.exercises[workout_exercise_id]

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
