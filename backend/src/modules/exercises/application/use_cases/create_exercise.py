from ...domain.entities.exercise import Exercise
from ...domain.exceptions import DuplicateExerciseNameError
from ...domain.interfaces.exercise_repository import ExerciseRepository


class CreateExercise:
    """Use case: create a new exercise for a user."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, user_id: int, name: str, category: str | None = None, logging_type: str = "weight_reps") -> Exercise:
        """
        Create a new exercise.

        Args:
            user_id: the owner's user id
            name: exercise name
            category: optional muscle group category
            logging_type: type of logging for the exercise (weight_reps, reps_only, weight_only, cardio)

        Returns:
            The created Exercise entity (with id set)

        Raises:
            DuplicateExerciseNameError: if an exercise with this name already exists for the user
        """
        if self.exercise_repository.exists_by_user_and_name(user_id, name):
            raise DuplicateExerciseNameError(f"An exercise named '{name}' already exists for you")
        exercise = Exercise(user_id=user_id, name=name, category=category, logging_type=logging_type)
        return self.exercise_repository.create(exercise)
