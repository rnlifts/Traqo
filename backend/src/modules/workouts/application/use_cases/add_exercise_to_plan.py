from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.exceptions import (
    ExerciseNotOwnedError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


class AddExerciseToPlan:
    """Use case: add an exercise to a plan (cross-module ownership check)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        exercise_repository_workout: WorkoutExerciseRepository,
        exercise_repository_domain: ExerciseRepository,
    ):
        self.plan_repository = plan_repository
        self.exercise_repository_workout = exercise_repository_workout
        self.exercise_repository_domain = exercise_repository_domain

    def execute(
        self,
        plan_id: int,
        exercise_id: int,
        requesting_user_id: int,
        target_sets: int | None = None,
        target_reps: int | None = None,
        target_weight: float | None = None,
    ) -> WorkoutExercise:
        """Add an exercise to a plan.

        Check order matters:
        1. Verify plan exists and is owned by user (prevents info leakage, null refs)
        2. Verify exercise exists and is owned by user (cross-module check)
        3. Add to plan with next order_number
        """
        # Step 1: Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Step 2: Load and validate exercise ownership (cross-module check via domain interface)
        exercise = self.exercise_repository_domain.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotOwnedError(f"Exercise {exercise_id} not found")

        if exercise.user_id != requesting_user_id:
            raise ExerciseNotOwnedError(
                f"User {requesting_user_id} does not own exercise {exercise_id}"
            )

        # Step 3: Determine next order_number
        existing_exercises = self.exercise_repository_workout.list_by_plan(plan_id)
        next_order = len(existing_exercises) + 1

        # Step 4: Add to plan
        workout_exercise = WorkoutExercise(
            workout_plan_id=plan_id,
            exercise_id=exercise_id,
            order_number=next_order,
            target_sets=target_sets,
            target_reps=target_reps,
            target_weight=target_weight,
        )
        return self.exercise_repository_workout.add(workout_exercise)
