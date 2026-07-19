from ...domain.entities.workout_session import WorkoutSession
from ...domain.entities.workout_set import WorkoutSet
from ...domain.exceptions import (
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository


class GetWorkoutSessionDetail:
    """Use case: retrieve a session and all its logged sets."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository

    def execute(self, user_id: int, session_id: int) -> tuple[WorkoutSession, list[WorkoutSet]]:
        """Get session details along with all logged sets.

        Args:
            user_id: The user requesting the detail.
            session_id: The session to retrieve.

        Returns:
            Tuple of (session, list of sets logged in that session).

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
        """
        # Load session
        session = self.session_repository.get_by_id(session_id)
        if not session:
            raise WorkoutSessionNotFoundError(f"Session {session_id} not found")

        # Check ownership
        if session.user_id != user_id:
            raise UnauthorizedWorkoutSessionAccessError(
                f"User {user_id} does not own session {session_id}"
            )

        # Load sets
        sets = self.set_repository.list_by_session(session_id)

        return session, sets
