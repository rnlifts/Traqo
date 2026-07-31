from ...domain.entities.exercise import Exercise
from ...domain.exceptions import DuplicateExerciseNameError
from ...domain.interfaces.exercise_repository import ExerciseRepository


class CreateExercise:
    """Use case: create a new exercise for a user."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(
        self,
        user_id: int,
        name: str,
        muscle_group: str | None = None,
        logging_type: str = "weight_reps",
        equipment: str | None = None,
        video_url: str | None = None,
        is_custom: bool = True,
    ) -> Exercise:
        """
        Create a new exercise.

        Args:
            user_id: the owner's user id
            name: exercise name
            muscle_group: optional muscle group
            logging_type: type of logging for the exercise (weight_reps, reps_only, weight_only, cardio)
            equipment: optional equipment description
            video_url: optional YouTube video URL
            is_custom: whether this is a custom exercise (default True)

        Returns:
            The created Exercise entity (with id set)

        Raises:
            DuplicateExerciseNameError: if an exercise with this name already exists for the user
        """
        if self.exercise_repository.exists_by_user_and_name(user_id, name):
            raise DuplicateExerciseNameError(f"An exercise named '{name}' already exists for you")
        exercise = Exercise(
            user_id=user_id,
            name=name,
            muscle_group=muscle_group,
            logging_type=logging_type,
            equipment=equipment,
            video_url=video_url,
            is_custom=is_custom,
        )
        return self.exercise_repository.create(exercise)
