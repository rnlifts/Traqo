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
    ):
        self.id = id
        self.user_id = user_id
        self.name = name
        self.created_at = created_at or datetime.utcnow()
        self.category = category
