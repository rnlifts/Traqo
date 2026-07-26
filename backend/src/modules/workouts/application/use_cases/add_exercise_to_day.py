from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.exceptions import (
    ExerciseNotOwnedError,
    PlanDayNotFoundError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


class AddExerciseToDay:
    """Use case: add an exercise to a plan day (cross-module ownership check)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        exercise_repository_workout: WorkoutExerciseRepository,
        exercise_repository_domain: ExerciseRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.exercise_repository_workout = exercise_repository_workout
        self.exercise_repository_domain = exercise_repository_domain

    def execute(
        self,
        plan_id: int,
        day_id: int,
        exercise_id: int,
        requesting_user_id: int,
        target_sets: int | None = None,
        target_reps: str | None = None,
        target_weight: float | None = None,
        target_duration_seconds: int | None = None,
        has_reps: bool = True,
        has_weight: bool = True,
        has_duration: bool = False,
    ) -> WorkoutExercise:
        """Add an exercise to a plan day.

        Check order matters:
        1. Verify plan exists and is owned by user (prevents info leakage, null refs)
        2. Verify day exists and belongs to this plan
        3. Verify exercise exists and is owned by user (cross-module check)
        4. Add to day with next order_number
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

        # Step 3: Load and validate exercise ownership (cross-module check via domain interface)
        exercise = self.exercise_repository_domain.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotOwnedError(f"Exercise {exercise_id} not found")

        if exercise.user_id != requesting_user_id:
            raise ExerciseNotOwnedError(
                f"User {requesting_user_id} does not own exercise {exercise_id}"
            )

        # Step 4: Determine next order_number within this day
        existing_exercises = self.exercise_repository_workout.list_by_day(day_id)
        next_order = len(existing_exercises) + 1

        # Step 5: Add to day
        workout_exercise = WorkoutExercise(
            plan_day_id=day_id,
            exercise_id=exercise_id,
            order_number=next_order,
            target_sets=target_sets,
            target_reps=target_reps,
            target_weight=target_weight,
            target_duration_seconds=target_duration_seconds,
            has_reps=has_reps,
            has_weight=has_weight,
            has_duration=has_duration,
        )
        return self.exercise_repository_workout.add(workout_exercise)
