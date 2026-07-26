class WorkoutSessionNotFoundError(Exception):
    """Raised when a workout session cannot be found."""

    pass


class UnauthorizedWorkoutSessionAccessError(Exception):
    """Raised when a user tries to access a workout session they don't own."""

    pass


class SessionAlreadyFinishedError(Exception):
    """Raised when attempting to modify a finished session (add set, finish again, etc.)."""

    pass


class InvalidSetDataError(Exception):
    """Raised when logged set data is invalid for the exercise's logging type."""

    pass
