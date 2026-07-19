from datetime import datetime


class PlanDay:
    """A day within a workout plan, containing its own exercise list."""

    def __init__(
        self,
        workout_plan_id: int,
        label: str,
        order_position: int,
        id: int | None = None,
        is_rest: bool = False,
        plan_week_id: int | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.id = id
        self.workout_plan_id = workout_plan_id
        self.label = label
        self.order_position = order_position
        self.is_rest = is_rest
        self.plan_week_id = plan_week_id
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
