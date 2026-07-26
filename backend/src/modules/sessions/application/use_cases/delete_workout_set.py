from ...domain.exceptions import (
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository


class DeleteWorkoutSet:
    """Use case: delete a logged workout set from an active session."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository

    def execute(self, user_id: int, session_id: int, set_id: int) -> None:
        """Delete a specific workout set from an active session.

        Checks are performed in order:
        1. Session ownership (404/403)
        2. Session not already finished (409)

        Args:
            user_id: The user deleting the set.
            session_id: The session this set belongs to.
            set_id: The set to delete.

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
            SessionAlreadyFinishedError: If the session is already finished.
        """
        # 1. Load session and check ownership
        session = self.session_repository.get_by_id(session_id)
        if not session:
            raise WorkoutSessionNotFoundError(f"Session {session_id} not found")

        if session.user_id != user_id:
            raise UnauthorizedWorkoutSessionAccessError(
                f"User {user_id} does not own session {session_id}"
            )

        # 2. Check session is not already finished
        if session.is_finished():
            raise SessionAlreadyFinishedError(
                f"Cannot delete set from finished session {session_id}"
            )

        # 3. Load the set and verify it actually belongs to this session
        workout_set = self.set_repository.get_by_id(set_id)
        if not workout_set or workout_set.workout_session_id != session_id:
            raise WorkoutSessionNotFoundError(f"Set {set_id} not found in session {session_id}")

        # 4. Delete the set
        self.set_repository.delete(set_id)
