"""Use case: discard an unresolved workout session."""

from ...domain.entities.workout_session import WorkoutSession
from ...domain.exceptions import (
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository


class DiscardWorkoutSession:
    """Delete an unresolved workout session and its sets."""

    def __init__(self, session_repository: WorkoutSessionRepository):
        self.session_repository = session_repository

    def execute(self, user_id: int, session_id: int) -> None:
        """
        Discard an unresolved session.

        Args:
            user_id: The user requesting the discard
            session_id: The session to discard

        Raises:
            WorkoutSessionNotFoundError: If session doesn't exist
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session
            SessionAlreadyFinishedError: If session is already finished
        """
        session = self.session_repository.get_by_id(session_id)
        if not session:
            raise WorkoutSessionNotFoundError(f"Session {session_id} not found")

        if session.user_id != user_id:
            raise UnauthorizedWorkoutSessionAccessError(
                f"User {user_id} does not own session {session_id}"
            )

        if session.is_finished():
            raise SessionAlreadyFinishedError(
                "Cannot discard a finished session — discard only applies to unresolved sessions"
            )

        self.session_repository.delete(session_id)
