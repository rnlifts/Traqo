class ExerciseException(Exception):
    """Base exception for exercises domain."""

    pass


class ExerciseNotFoundError(ExerciseException):
    """Raised when an exercise is not found."""

    pass


class UnauthorizedExerciseAccessError(ExerciseException):
    """Raised when a user tries to access an exercise they don't own."""

    pass


class ExerciseInUseError(ExerciseException):
    """Raised when trying to delete an exercise that's used in workout plans."""

    pass
