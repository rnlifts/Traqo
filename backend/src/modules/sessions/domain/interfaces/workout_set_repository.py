from abc import ABC, abstractmethod

from ..entities.workout_set import WorkoutSet


class WorkoutSetRepository(ABC):
    """Abstract repository for workout sets."""

    @abstractmethod
    def create(self, workout_set: WorkoutSet) -> WorkoutSet:
        """Create and persist a new workout set."""
        pass

    @abstractmethod
    def get_by_id(self, set_id: int) -> WorkoutSet | None:
        """Retrieve a workout set by its id."""
        pass

    @abstractmethod
    def get_by_session_exercise_and_set_number(
        self, session_id: int, exercise_id: int, set_number: int
    ) -> WorkoutSet | None:
        """Retrieve a workout set by session, exercise, and set number.

        Used for upsert logic when logging a set at a specific number.
        """
        pass

    @abstractmethod
    def update(self, workout_set: WorkoutSet) -> WorkoutSet:
        """Update an existing workout set."""
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

    @abstractmethod
    def delete(self, set_id: int) -> None:
        """Delete a workout set by its id."""
        pass

    @abstractmethod
    def list_finished_by_user_and_exercise(
        self, user_id: int, exercise_id: int
    ) -> list[WorkoutSet]:
        """Retrieve all finished sets for a user and exercise, ordered chronologically.

        Returns sets from finished sessions only (completed_at IS NOT NULL),
        ordered by session.started_at ASC, then set.set_number ASC.

        Used for per-exercise progress views.
        """
        pass
