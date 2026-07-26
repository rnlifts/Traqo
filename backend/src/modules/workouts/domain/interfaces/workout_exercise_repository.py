from abc import ABC, abstractmethod

from ..entities.workout_exercise import WorkoutExercise


class WorkoutExerciseRepository(ABC):
    """Interface for workout exercise persistence."""

    @abstractmethod
    def add(self, workout_exercise: WorkoutExercise) -> WorkoutExercise:
        """Add an exercise to a plan day. Returns the created workout_exercise with id set."""
        pass

    @abstractmethod
    def list_by_plan(self, plan_id: int) -> list[WorkoutExercise]:
        """Get all exercises for a plan (across all days), ordered by order_number within each day."""
        pass

    @abstractmethod
    def list_by_day(self, day_id: int) -> list[WorkoutExercise]:
        """Get all exercises for a plan day, ordered by order_number."""
        pass

    @abstractmethod
    def get_by_id(self, workout_exercise_id: int) -> WorkoutExercise | None:
        """Retrieve a workout_exercise by id. Returns None if not found."""
        pass

    @abstractmethod
    def remove(self, workout_exercise_id: int) -> None:
        """Remove an exercise from a plan day."""
        pass

    @abstractmethod
    def update(self, workout_exercise: WorkoutExercise) -> WorkoutExercise:
        """Update an existing workout_exercise. Returns the updated entity."""
        pass

    @abstractmethod
    def update_order(self, workout_exercise_id: int, new_order_number: int) -> WorkoutExercise:
        """Update the order_number of a workout_exercise. Returns the updated entity."""
        pass
