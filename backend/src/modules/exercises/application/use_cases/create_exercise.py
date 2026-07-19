from ...domain.entities.exercise import Exercise
from ...domain.interfaces.exercise_repository import ExerciseRepository


class CreateExercise:
    """Use case: create a new exercise for a user."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, user_id: int, name: str, category: str | None = None) -> Exercise:
        """
        Create a new exercise.

        Args:
            user_id: the owner's user id
            name: exercise name
            category: optional muscle group category

        Returns:
            The created Exercise entity (with id set)
        """
        exercise = Exercise(user_id=user_id, name=name, category=category)
        return self.exercise_repository.create(exercise)
