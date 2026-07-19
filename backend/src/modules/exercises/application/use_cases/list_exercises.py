from ...domain.entities.exercise import Exercise
from ...domain.interfaces.exercise_repository import ExerciseRepository


class ListExercises:
    """Use case: list all exercises for a user."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, user_id: int) -> list[Exercise]:
        """
        List all exercises for a user.

        Args:
            user_id: the user's id

        Returns:
            List of Exercise entities (empty list if none exist)
        """
        return self.exercise_repository.list_by_user(user_id)
