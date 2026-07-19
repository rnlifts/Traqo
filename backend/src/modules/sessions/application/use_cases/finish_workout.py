from datetime import datetime

from ...domain.exceptions import (
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository


class FinishWorkout:
    """Use case: mark a workout session as completed."""

    def __init__(self, session_repository: WorkoutSessionRepository):
        self.session_repository = session_repository

    def execute(self, user_id: int, session_id: int) -> None:
        """Mark a workout session as finished.

        Args:
            user_id: The user finishing the workout.
            session_id: The session to finish.

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
            SessionAlreadyFinishedError: If the session is already finished.
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

        # Check not already finished
        if session.is_finished():
            raise SessionAlreadyFinishedError(
                f"Session {session_id} is already finished"
            )

        # Mark as finished
        session.finish(datetime.utcnow())
        self.session_repository.update(session)
