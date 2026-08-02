from datetime import datetime


class WorkoutSession:
    """Domain entity representing an actual workout performed by a user."""

    def __init__(
        self,
        user_id: int,
        workout_plan_id: int | None,
        started_at: datetime,
        plan_day_id: int | None = None,
        plan_week_id: int | None = None,
        completed_at: datetime | None = None,
        id: int | None = None,
    ):
        self.id = id
        self.user_id = user_id
        self.workout_plan_id = workout_plan_id
        self.plan_day_id = plan_day_id
        self.plan_week_id = plan_week_id
        self.started_at = started_at
        self.completed_at = completed_at

    def is_finished(self) -> bool:
        """Check if this session has been marked complete."""
        return self.completed_at is not None

    def finish(self, completed_at: datetime) -> None:
        """Mark this session as finished with the given completion timestamp."""
        self.completed_at = completed_at
