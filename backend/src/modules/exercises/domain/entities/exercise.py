from datetime import datetime


class Exercise:
    """An exercise created by a user."""

    def __init__(
        self,
        user_id: int,
        name: str,
        id: int | None = None,
        created_at: datetime | None = None,
        category: str | None = None,
        logging_type: str = "weight_reps",
    ):
        self.id = id
        self.user_id = user_id
        self.name = name
        self.created_at = created_at or datetime.utcnow()
        self.category = category
        self.logging_type = logging_type
