from ...domain.entities.workout_set import WorkoutSet
from ...domain.exceptions import (
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercises.domain.exceptions import UnauthorizedExerciseAccessError
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


class AddWorkoutSet:
    """Use case: log a completed set during an active workout session."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        exercise_repository: ExerciseRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository
        self.exercise_repository = exercise_repository

    def execute(
        self,
        user_id: int,
        session_id: int,
        exercise_id: int,
        weight: float,
        reps: int,
        notes: str = "",
    ) -> WorkoutSet:
        """Log a set for the given exercise in an active workout session.

        Checks are performed in order:
        1. Session ownership (404/403)
        2. Session not already finished (409)
        3. Exercise ownership (403)

        Args:
            user_id: The user logging the set.
            session_id: The session this set belongs to.
            exercise_id: The exercise being logged.
            weight: Weight used in this set.
            reps: Reps completed in this set.
            notes: Optional notes about the set.

        Returns:
            The created WorkoutSet.

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
            SessionAlreadyFinishedError: If the session is already finished.
            UnauthorizedExerciseAccessError: If the user doesn't own the exercise.
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
                f"Cannot add set to finished session {session_id}"
            )

        # 3. Validate exercise ownership
        exercise = self.exercise_repository.get_by_id(exercise_id)
        if not exercise or exercise.user_id != user_id:
            raise UnauthorizedExerciseAccessError(
                f"User {user_id} does not own exercise {exercise_id}"
            )

        # Compute next set_number for this (session, exercise) pair
        existing_count = self.set_repository.count_by_session_and_exercise(
            session_id, exercise_id
        )
        next_set_number = existing_count + 1

        # Create and persist the set
        workout_set = WorkoutSet(
            workout_session_id=session_id,
            exercise_id=exercise_id,
            set_number=next_set_number,
            weight=weight,
            reps=reps,
            notes=notes,
        )
        return self.set_repository.create(workout_set)
