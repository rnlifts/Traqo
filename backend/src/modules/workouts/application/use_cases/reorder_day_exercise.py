from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.exceptions import (
    PlanDayNotFoundError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class ReorderDayExercise:
    """Use case: move an exercise up or down one position within a plan day."""

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
        direction: str,
    ) -> WorkoutExercise:
        """Move an exercise up or down within a day, swapping with the adjacent exercise.

        Check order:
        1. Verify plan exists and is owned by user
        2. Verify day exists and belongs to this plan
        3. Verify exercise exists and belongs to this day
        4. Swap order_numbers with adjacent exercise
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

        # Step 3: Load and validate exercise
        exercise = self.exercise_repository.get_by_id(workout_exercise_id)
        if not exercise:
            raise ValueError(f"Workout exercise {workout_exercise_id} not found")

        if exercise.plan_day_id != day_id:
            raise ValueError(f"Exercise {workout_exercise_id} does not belong to day {day_id}")

        # Step 4: Determine target order_number
        if direction == "up":
            target_order = exercise.order_number - 1
            if target_order < 1:
                raise ValueError("Cannot move exercise up: already at top")
        elif direction == "down":
            target_order = exercise.order_number + 1
        else:
            raise ValueError(f"Invalid direction: {direction}")

        # Step 5: Find the exercise currently at the target position within this day
        exercises_in_day = self.exercise_repository.list_by_day(day_id)
        neighbor = None
        for e in exercises_in_day:
            if e.order_number == target_order:
                neighbor = e
                break

        if not neighbor:
            raise ValueError(f"No exercise at position {target_order} in this day")

        # Step 6: Swap order_number values using a temporary sentinel (-999) to avoid UNIQUE constraint violation
        # Step 1: Move the neighbor to the sentinel
        self.exercise_repository.update_order(neighbor.id, -999)
        # Step 2: Move the exercise to the neighbor's original position
        self.exercise_repository.update_order(workout_exercise_id, target_order)
        # Step 3: Move the neighbor to the exercise's original position
        self.exercise_repository.update_order(neighbor.id, exercise.order_number)

        # Return the updated exercise
        return self.exercise_repository.get_by_id(workout_exercise_id)
