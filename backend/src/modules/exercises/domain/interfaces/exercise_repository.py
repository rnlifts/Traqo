from abc import ABC, abstractmethod

from ..entities.exercise import Exercise


class ExerciseRepository(ABC):
    """Interface for exercise persistence."""

    @abstractmethod
    def create(self, exercise: Exercise) -> Exercise:
        """Create and persist a new exercise. Returns the exercise with id set."""
        pass

    @abstractmethod
    def list_by_user(self, user_id: int) -> list[Exercise]:
        """Get all exercises for a user. Returns empty list if none exist."""
        pass

    @abstractmethod
    def get_by_id(self, exercise_id: int) -> Exercise | None:
        """Retrieve an exercise by id. Returns None if not found."""
        pass

    @abstractmethod
    def delete(self, exercise_id: int) -> None:
        """Delete an exercise by id."""
        pass

    @abstractmethod
    def is_used_in_any_plan(self, exercise_id: int) -> bool:
        """Check if an exercise is used in any workout plan."""
        pass
