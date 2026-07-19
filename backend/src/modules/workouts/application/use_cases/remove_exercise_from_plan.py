from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository


class RemoveExerciseFromPlan:
    """Use case: remove an exercise from a plan."""

    def __init__(self, exercise_repository: WorkoutExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, workout_exercise_id: int) -> None:
        """Remove an exercise from a plan."""
        self.exercise_repository.remove(workout_exercise_id)
