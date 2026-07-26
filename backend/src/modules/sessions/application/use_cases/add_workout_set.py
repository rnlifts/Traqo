from ...domain.entities.workout_set import WorkoutSet
from ...domain.exceptions import (
    InvalidSetDataError,
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercises.domain.exceptions import UnauthorizedExerciseAccessError
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository
from src.modules.workouts.domain.interfaces.workout_exercise_repository import (
    WorkoutExerciseRepository,
)


class AddWorkoutSet:
    """Use case: log a completed set during an active workout session."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        exercise_repository: ExerciseRepository,
        workout_exercise_repository: WorkoutExerciseRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository
        self.exercise_repository = exercise_repository
        self.workout_exercise_repository = workout_exercise_repository

    def execute(
        self,
        user_id: int,
        session_id: int,
        workout_exercise_id: int,
        set_number: int,
        weight: float | None = None,
        reps: int | None = None,
        duration_seconds: int | None = None,
        notes: str = "",
    ) -> WorkoutSet:
        """Log or update a set for the given plan-exercise in an active workout session (upsert).

        If a set at this (session, workout_exercise, set_number) already exists, updates it in place.
        Otherwise, creates a new set.

        Validation is permissive: a set must have at least one of weight, reps, or duration_seconds.
        All provided values (whether weight, reps, or duration) are saved as-is; no fields are
        silently dropped based on exercise type. Exercise field-presence flags (has_reps/has_weight/has_duration)
        are a display-only concern for the UI and do not constrain what the backend accepts and persists.

        Checks are performed in order:
        1. Session ownership (404/403)
        2. Session not already finished (409)
        3. Workout exercise exists (404)
        4. Exercise ownership (403)
        5. Logged data is valid (at least one of weight, reps, duration_seconds is non-null) (400)

        Args:
            user_id: The user logging the set.
            session_id: The session this set belongs to.
            workout_exercise_id: The specific plan-exercise instance being logged.
            set_number: The specific set number being logged (caller-specified).
            weight: Weight used in this set (optional, in lbs/kg).
            reps: Reps completed in this set (optional).
            duration_seconds: Duration in seconds (optional).
            notes: Optional notes about the set.

        Returns:
            The created or updated WorkoutSet.

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
            SessionAlreadyFinishedError: If the session is already finished.
            UnauthorizedExerciseAccessError: If the user doesn't own the exercise.
            InvalidSetDataError: If no values provided (all weight, reps, duration_seconds are null).
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

        # 3. Load the workout exercise instance to get the actual exercise_id
        workout_exercise = self.workout_exercise_repository.get_by_id(workout_exercise_id)
        if not workout_exercise:
            raise ValueError(f"Workout exercise {workout_exercise_id} not found")

        # 4. Validate exercise ownership
        exercise = self.exercise_repository.get_by_id(workout_exercise.exercise_id)
        if not exercise or exercise.user_id != user_id:
            raise UnauthorizedExerciseAccessError(
                f"User {user_id} does not own exercise {workout_exercise.exercise_id}"
            )

        # 5. Permissive validation: a set needs at least one value (weight, reps, or duration)
        if weight is None and reps is None and duration_seconds is None:
            raise InvalidSetDataError("A set needs at least a weight, reps, or duration value")

        # 6. Check if a set already exists at this (session, workout_exercise, set_number)
        existing_set = self.set_repository.get_by_session_exercise_and_set_number(
            session_id, workout_exercise_id, set_number
        )

        if existing_set:
            # Update existing set with validated values
            existing_set.weight = weight
            existing_set.reps = reps
            existing_set.duration_seconds = duration_seconds
            existing_set.notes = notes
            return self.set_repository.update(existing_set)
        else:
            # Create new set with validated values
            workout_set = WorkoutSet(
                workout_session_id=session_id,
                exercise_id=workout_exercise.exercise_id,
                workout_exercise_id=workout_exercise_id,
                set_number=set_number,
                weight=weight,
                reps=reps,
                duration_seconds=duration_seconds,
                notes=notes,
            )
            return self.set_repository.create(workout_set)
