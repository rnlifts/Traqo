"""Use case: Update an exercise's targets and notes in place within a day."""

from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
    PlanDayNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository


class UpdateExerciseInDay:
    """Use case: Update an exercise's target_sets, target_reps, target_weight, and/or notes in place.

    This allows editing a WorkoutExercise's prescription without removing and re-adding it.
    Per spec §1.5: exercise_id itself is immutable (remove/re-add only).
    """

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
        target_sets: int | None = None,
        target_reps: str | None = None,
        target_weight: float | None = None,
        target_duration_seconds: int | None = None,
        notes: str | None = None,
        has_reps: bool | None = None,
        has_weight: bool | None = None,
        has_duration: bool | None = None,
    ) -> dict:
        """Update an exercise's prescription and notes.

        Supports partial updates: only the fields provided will be changed.
        exercise_id and order_number are never changed.

        Args:
            plan_id: The workout plan id.
            day_id: The plan day id.
            workout_exercise_id: The workout exercise id to update.
            requesting_user_id: The authenticated user id.
            target_sets: New target sets count (or None to leave unchanged).
            target_reps: New target reps (or None to leave unchanged).
            target_weight: New target weight (or None to leave unchanged).
            notes: New notes (or None to leave unchanged).

        Returns:
            dict with the updated exercise data.

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan.
            PlanDayNotFoundError: If the day doesn't exist or doesn't belong to the plan.
            PlanDayNotFoundError: If the exercise doesn't exist or doesn't belong to the day.
        """
        # Validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Validate day exists and belongs to plan
        day = self.day_repository.get_by_id(day_id)
        if not day:
            raise PlanDayNotFoundError(f"Day {day_id} not found")

        if day.workout_plan_id != plan_id:
            raise PlanDayNotFoundError(f"Day {day_id} does not belong to plan {plan_id}")

        # Load exercise
        exercise = self.exercise_repository.get_by_id(workout_exercise_id)
        if not exercise:
            raise PlanDayNotFoundError(f"Exercise {workout_exercise_id} not found")

        # Verify exercise belongs to this day
        if exercise.plan_day_id != day_id:
            raise PlanDayNotFoundError(
                f"Exercise {workout_exercise_id} does not belong to day {day_id}"
            )

        # Update fields if provided (partial update semantics)
        if target_sets is not None:
            exercise.target_sets = target_sets
        if target_reps is not None:
            exercise.target_reps = target_reps
        if target_weight is not None:
            exercise.target_weight = target_weight
        if target_duration_seconds is not None:
            exercise.target_duration_seconds = target_duration_seconds
        if notes is not None:
            exercise.notes = notes
        if has_reps is not None:
            exercise.has_reps = has_reps
        if has_weight is not None:
            exercise.has_weight = has_weight
        if has_duration is not None:
            exercise.has_duration = has_duration

        # Persist the update
        updated_exercise = self.exercise_repository.update(exercise)

        # Return updated exercise
        return {
            "id": updated_exercise.id,
            "plan_day_id": updated_exercise.plan_day_id,
            "exercise_id": updated_exercise.exercise_id,
            "order_number": updated_exercise.order_number,
            "target_sets": updated_exercise.target_sets,
            "target_reps": updated_exercise.target_reps,
            "target_weight": updated_exercise.target_weight,
            "target_duration_seconds": updated_exercise.target_duration_seconds,
            "notes": updated_exercise.notes,
            "has_reps": updated_exercise.has_reps,
            "has_weight": updated_exercise.has_weight,
            "has_duration": updated_exercise.has_duration,
        }
