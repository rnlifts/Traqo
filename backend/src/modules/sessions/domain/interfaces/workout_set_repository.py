from abc import ABC, abstractmethod

from ..entities.workout_set import WorkoutSet


class WorkoutSetRepository(ABC):
    """Abstract repository for workout sets."""

    @abstractmethod
    def create(self, workout_set: WorkoutSet) -> WorkoutSet:
        """Create and persist a new workout set."""
        pass

    @abstractmethod
    def list_by_session(self, session_id: int) -> list[WorkoutSet]:
        """Retrieve all sets logged in a given session."""
        pass

    @abstractmethod
    def count_by_session_and_exercise(self, session_id: int, exercise_id: int) -> int:
        """Count how many sets of a specific exercise have been logged in a session.

        Used to compute the next set_number for that (session_id, exercise_id) pair.
        """
        pass
