from ...domain.exceptions import (
    ExerciseInUseError,
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)
from ...domain.interfaces.exercise_repository import ExerciseRepository


class DeleteExercise:
    """Use case: delete an exercise (with ownership and usage checks)."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, exercise_id: int, requesting_user_id: int) -> None:
        """
        Delete an exercise, but only if the requesting user owns it and it's not in use.

        Args:
            exercise_id: the exercise to delete
            requesting_user_id: the user attempting the deletion

        Raises:
            ExerciseNotFoundError: if the exercise doesn't exist
            UnauthorizedExerciseAccessError: if the exercise belongs to a different user
            ExerciseInUseError: if the exercise is used in any workout plans
        """
        exercise = self.exercise_repository.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotFoundError(f"Exercise {exercise_id} not found")

        if exercise.user_id != requesting_user_id:
            raise UnauthorizedExerciseAccessError(
                f"User {requesting_user_id} does not own exercise {exercise_id}"
            )

        if self.exercise_repository.is_used_in_any_plan(exercise_id):
            raise ExerciseInUseError(
                f"Exercise {exercise_id} is used in one or more workout plans"
            )

        self.exercise_repository.delete(exercise_id)
