from datetime import datetime
from typing import Literal


class PlanWeek:
    """A week within a weeks-type workout plan."""

    def __init__(
        self,
        workout_plan_id: int,
        week_number: int,
        mode: Literal["base", "linked", "custom"],
        id: int | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.id = id
        self.workout_plan_id = workout_plan_id
        self.week_number = week_number
        self.mode = mode
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
