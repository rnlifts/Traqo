"""Unit tests for AddExerciseToPlan use case.

Tests the application layer logic for adding exercises to workout plans,
including the new target_sets, target_reps, and target_weight fields.
"""

import pytest

from src.modules.workouts.application.use_cases.add_exercise_to_plan import (
    AddExerciseToPlan,
)
from src.modules.workouts.domain.exceptions import (
    ExerciseNotOwnedError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from src.modules.workouts.domain.entities.workout_exercise import WorkoutExercise


class TestAddExerciseToPlanTargetFields:
    """Test the new target_sets, target_reps, target_weight fields."""

    def test_execute_with_all_target_fields_provided(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        sample_exercise,
        user_id,
    ):
        """Test that execute() stores target values when provided."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        result = use_case.execute(
            plan_id=sample_plan.id,
            exercise_id=sample_exercise.id,
            requesting_user_id=user_id,
            target_sets=4,
            target_reps=8,
            target_weight=225.0,
        )

        assert isinstance(result, WorkoutExercise)
        assert result.id is not None
        assert result.workout_plan_id == sample_plan.id
        assert result.exercise_id == sample_exercise.id
        assert result.target_sets == 4
        assert result.target_reps == 8
        assert result.target_weight == 225.0

    def test_execute_with_no_target_fields(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        sample_exercise,
        user_id,
    ):
        """Test that execute() produces None values when targets not provided."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        result = use_case.execute(
            plan_id=sample_plan.id,
            exercise_id=sample_exercise.id,
            requesting_user_id=user_id,
        )

        assert isinstance(result, WorkoutExercise)
        assert result.id is not None
        assert result.target_sets is None
        assert result.target_reps is None
        assert result.target_weight is None

    def test_execute_with_partial_target_fields(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        sample_exercise,
        user_id,
    ):
        """Test that execute() handles partial target values."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        result = use_case.execute(
            plan_id=sample_plan.id,
            exercise_id=sample_exercise.id,
            requesting_user_id=user_id,
            target_sets=3,
            target_weight=185.5,
        )

        assert result.target_sets == 3
        assert result.target_reps is None
        assert result.target_weight == 185.5

    def test_execute_with_zero_target_weight(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        sample_exercise,
        user_id,
    ):
        """Test that zero is accepted for target_weight (bodyweight exercises)."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        result = use_case.execute(
            plan_id=sample_plan.id,
            exercise_id=sample_exercise.id,
            requesting_user_id=user_id,
            target_weight=0.0,
        )

        assert result.target_weight == 0.0

    def test_execute_assigns_correct_order_number(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        user_id,
    ):
        """Test that order_number is assigned correctly when adding exercises."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        # Create a plan and two exercises
        plan = in_memory_plan_repo.create(
            type('WorkoutPlan', (), {
                'id': None, 'user_id': user_id, 'name': 'Test Plan',
                'created_at': None, 'updated_at': None
            })()
        )
        ex1 = in_memory_exercise_repo.create(
            type('Exercise', (), {
                'id': None, 'user_id': user_id, 'name': 'Ex1',
                'created_at': None
            })()
        )
        ex2 = in_memory_exercise_repo.create(
            type('Exercise', (), {
                'id': None, 'user_id': user_id, 'name': 'Ex2',
                'created_at': None
            })()
        )

        result1 = use_case.execute(plan.id, ex1.id, user_id)
        result2 = use_case.execute(plan.id, ex2.id, user_id)

        assert result1.order_number == 1
        assert result2.order_number == 2


class TestAddExerciseToPlanOwnershipChecks:
    """Test ownership validation (regression tests)."""

    def test_execute_plan_not_found_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_exercise,
        user_id,
    ):
        """Test that WorkoutPlanNotFoundError is raised when plan doesn't exist."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        with pytest.raises(WorkoutPlanNotFoundError) as exc_info:
            use_case.execute(
                plan_id=999,  # Non-existent plan
                exercise_id=sample_exercise.id,
                requesting_user_id=user_id,
            )
        assert "not found" in str(exc_info.value).lower()

    def test_execute_plan_not_owned_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        sample_exercise,
        another_user_id,
    ):
        """Test that UnauthorizedWorkoutPlanAccessError when user doesn't own plan."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        with pytest.raises(UnauthorizedWorkoutPlanAccessError) as exc_info:
            use_case.execute(
                plan_id=sample_plan.id,
                exercise_id=sample_exercise.id,
                requesting_user_id=another_user_id,  # Different user
            )
        assert "does not own" in str(exc_info.value).lower()

    def test_execute_exercise_not_found_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        user_id,
    ):
        """Test that ExerciseNotOwnedError when exercise doesn't exist."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        with pytest.raises(ExerciseNotOwnedError) as exc_info:
            use_case.execute(
                plan_id=sample_plan.id,
                exercise_id=999,  # Non-existent exercise
                requesting_user_id=user_id,
            )
        assert "not found" in str(exc_info.value).lower()

    def test_execute_exercise_not_owned_raises_error(
        self,
        in_memory_plan_repo,
        in_memory_workout_exercise_repo,
        in_memory_exercise_repo,
        sample_plan,
        another_user_exercise,
        user_id,
    ):
        """Test that ExerciseNotOwnedError when user doesn't own exercise."""
        use_case = AddExerciseToPlan(
            in_memory_plan_repo,
            in_memory_workout_exercise_repo,
            in_memory_exercise_repo,
        )

        with pytest.raises(ExerciseNotOwnedError) as exc_info:
            use_case.execute(
                plan_id=sample_plan.id,
                exercise_id=another_user_exercise.id,  # Exercise owned by another user
                requesting_user_id=user_id,
            )
        assert "does not own" in str(exc_info.value).lower()
