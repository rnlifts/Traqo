from abc import ABC, abstractmethod

from ..entities.workout_exercise_set_target import WorkoutExerciseSetTarget


class WorkoutExerciseSetTargetRepository(ABC):
    """Interface for workout exercise set target persistence."""

    @abstractmethod
    def add(self, set_target: WorkoutExerciseSetTarget) -> WorkoutExerciseSetTarget:
        """Add a per-set target. Returns the created set_target with id set."""
        pass

    @abstractmethod
    def get_by_id(self, set_target_id: int) -> WorkoutExerciseSetTarget | None:
        """Retrieve a set_target by id. Returns None if not found."""
        pass

    @abstractmethod
    def get_by_workout_exercise_and_set_number(
        self, workout_exercise_id: int, set_number: int
    ) -> WorkoutExerciseSetTarget | None:
        """Retrieve a set_target by workout_exercise_id and set_number. Returns None if not found."""
        pass

    @abstractmethod
    def list_by_workout_exercise(self, workout_exercise_id: int) -> list[WorkoutExerciseSetTarget]:
        """Get all per-set targets for a workout_exercise, ordered by set_number. Returns empty list if none exist."""
        pass

    @abstractmethod
    def delete(self, set_target_id: int) -> None:
        """Delete a set_target by id."""
        pass

    @abstractmethod
    def delete_by_workout_exercise(self, workout_exercise_id: int) -> None:
        """Delete all set_targets for a workout_exercise (cascade handled by DB)."""
        pass

    @abstractmethod
    def update(self, set_target: WorkoutExerciseSetTarget) -> WorkoutExerciseSetTarget:
        """Update an existing set_target. Returns the updated entity."""
        pass
