class WorkoutException(Exception):
    """Base exception for workouts domain."""

    pass


class WorkoutPlanNotFoundError(WorkoutException):
    """Raised when a workout plan is not found."""

    pass


class UnauthorizedWorkoutPlanAccessError(WorkoutException):
    """Raised when a user tries to access a plan they don't own."""

    pass


class ExerciseNotOwnedError(WorkoutException):
    """Raised when trying to link an exercise that doesn't belong to the user."""

    pass


class WorkoutPlanHasSessionsError(WorkoutException):
    """Raised when trying to delete a plan that has recorded workout sessions."""

    pass


class PlanDayNotFoundError(WorkoutException):
    """Raised when a plan day is not found."""

    pass


class UnauthorizedPlanDayAccessError(WorkoutException):
    """Raised when a user tries to access a plan day they don't own."""

    pass


class DuplicateWeekdayInPlanError(WorkoutException):
    """Raised when trying to add a weekday that's already claimed by another day in the same plan."""

    pass


class PlanDayHasSessionsError(WorkoutException):
    """Raised when trying to delete a plan day that has recorded workout sessions."""

    pass


class WeekHasSessionsError(WorkoutException):
    """Raised when trying to revert a custom week to linked when it has recorded workout sessions."""

    pass


class InvalidPlanStructureError(WorkoutException):
    """Raised when a bulk plan creation request has invalid structure."""

    pass


class InvalidWeekModeError(WorkoutException):
    """Raised when week modes are invalid (e.g., week 1 not base, multiple base weeks)."""

    pass


class TotalUnitsMismatchError(WorkoutException):
    """Raised when total_units doesn't match the provided days/weeks count."""

    pass


class LinkedWeekWithDaysError(WorkoutException):
    """Raised when a linked week includes days (which it shouldn't)."""

    pass
