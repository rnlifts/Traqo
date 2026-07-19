from datetime import datetime


from typing import Literal


class WorkoutPlan:
    """A workout plan template created by a user."""

    def __init__(
        self,
        user_id: int,
        name: str,
        id: int | None = None,
        unit_type: Literal["days", "weeks"] | None = None,
        total_units: int | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ):
        self.id = id
        self.user_id = user_id
        self.name = name
        self.unit_type = unit_type
        self.total_units = total_units
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
