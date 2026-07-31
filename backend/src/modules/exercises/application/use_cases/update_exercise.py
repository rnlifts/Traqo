from ...domain.entities.exercise import Exercise
from ...domain.exceptions import (
    DuplicateExerciseNameError,
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)
from ...domain.interfaces.exercise_repository import ExerciseRepository


class UpdateExercise:
    """Use case: update an exercise's fields."""

    def __init__(self, exercise_repository: ExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(
        self,
        exercise_id: int,
        requesting_user_id: int,
        name: str | None = None,
        muscle_group: str | None = None,
        equipment: str | None = None,
        video_url: str | None = None,
    ) -> Exercise:
        """
        Update an exercise's fields.

        Args:
            exercise_id: the exercise to update
            requesting_user_id: the user attempting the update
            name: new name (if provided)
            muscle_group: new muscle group (if provided)
            equipment: new equipment (if provided)
            video_url: new video URL (if provided)

        Returns:
            The updated Exercise entity

        Raises:
            ExerciseNotFoundError: if the exercise doesn't exist
            UnauthorizedExerciseAccessError: if the exercise doesn't belong to the requester
            DuplicateExerciseNameError: if the new name collides with another of the user's exercises
        """
        exercise = self.exercise_repository.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotFoundError(f"Exercise {exercise_id} not found")

        if exercise.user_id != requesting_user_id:
            raise UnauthorizedExerciseAccessError(
                f"User {requesting_user_id} does not own exercise {exercise_id}"
            )

        # If name is being changed, check for duplicates (excluding this exercise)
        if name is not None and name != exercise.name:
            if self.exercise_repository.exists_by_user_and_name_excluding_id(
                requesting_user_id, name, exercise_id
            ):
                raise DuplicateExerciseNameError(f"An exercise named '{name}' already exists for you")
            exercise.name = name

        # Update optional fields
        if muscle_group is not None:
            exercise.muscle_group = muscle_group
        if equipment is not None:
            exercise.equipment = equipment
        if video_url is not None:
            exercise.video_url = video_url

        return self.exercise_repository.update(exercise)
