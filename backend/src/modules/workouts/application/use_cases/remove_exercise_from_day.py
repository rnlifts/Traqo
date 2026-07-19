from ...domain.exceptions import (
    PlanDayNotFoundError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class RemoveExerciseFromDay:
    """Use case: remove an exercise from a plan day."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        exercise_repository: WorkoutExerciseRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.exercise_repository = exercise_repository

    def execute(
        self,
        plan_id: int,
        day_id: int,
        workout_exercise_id: int,
        requesting_user_id: int,
    ) -> None:
        """Remove an exercise from a plan day.

        Check order:
        1. Verify plan exists and is owned by user
        2. Verify day exists and belongs to this plan
        3. Verify exercise exists and belongs to this day
        4. Remove the exercise
        """
        # Step 1: Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Step 2: Load and validate day
        day = self.day_repository.get_by_id(day_id)
        if not day:
            raise PlanDayNotFoundError(f"Day {day_id} not found")

        if day.workout_plan_id != plan_id:
            raise PlanDayNotFoundError(f"Day {day_id} does not belong to plan {plan_id}")

        # Step 3: Verify exercise belongs to this day
        exercise = self.exercise_repository.get_by_id(workout_exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {workout_exercise_id} not found")

        if exercise.plan_day_id != day_id:
            raise ValueError(f"Exercise {workout_exercise_id} does not belong to day {day_id}")

        # Step 4: Remove the exercise
        self.exercise_repository.remove(workout_exercise_id)
