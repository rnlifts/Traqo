from datetime import datetime


class User:
    """A user account in Traqo."""

    def __init__(
        self,
        username: str,
        display_name: str,
        password_hash: str,
        id: int | None = None,
        created_at: datetime | None = None,
    ):
        self.id = id
        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.created_at = created_at or datetime.utcnow()
