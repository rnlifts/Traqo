from abc import ABC, abstractmethod

from ..entities.workout_session import WorkoutSession


class WorkoutSessionRepository(ABC):
    """Abstract repository for workout sessions."""

    @abstractmethod
    def create(self, session: WorkoutSession) -> WorkoutSession:
        """Create and persist a new workout session."""
        pass

    @abstractmethod
    def get_by_id(self, session_id: int) -> WorkoutSession | None:
        """Retrieve a workout session by id."""
        pass

    @abstractmethod
    def update(self, session: WorkoutSession) -> WorkoutSession:
        """Update an existing workout session (e.g., set completed_at)."""
        pass

    @abstractmethod
    def list_finished_by_user(self, user_id: int) -> list[WorkoutSession]:
        """Retrieve all finished sessions for a user, ordered by started_at descending."""
        pass

    @abstractmethod
    def exists_for_plan(self, plan_id: int) -> bool:
        """Check if any sessions exist for a given plan (finished or in-progress)."""
        pass

    @abstractmethod
    def exists_for_day(self, day_id: int) -> bool:
        """Check if any sessions exist for a given plan day (finished or in-progress)."""
        pass

    @abstractmethod
    def get_most_recent_finished_for_day(
        self, day_id: int, exclude_session_id: int | None = None
    ) -> "WorkoutSession | None":
        """Get the most recently started finished session for a given plan day.

        Args:
            day_id: The plan day to search for sessions.
            exclude_session_id: Optional session id to exclude from the search
                (useful to exclude the current in-progress session).

        Returns:
            The most recent finished session, or None if no finished session exists.
        """
        pass

    @abstractmethod
    def find_unresolved_by_user(self, user_id: int) -> "WorkoutSession | None":
        """Return the user's most recent session with completed_at IS NULL, or None."""
        pass

    @abstractmethod
    def delete(self, session_id: int) -> None:
        """Permanently delete a session and (via DB cascade) its sets."""
        pass
