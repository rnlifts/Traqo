from datetime import datetime


class Exercise:
    """An exercise created by a user."""

    def __init__(
        self,
        user_id: int,
        name: str,
        id: int | None = None,
        created_at: datetime | None = None,
        muscle_group: str | None = None,
        logging_type: str = "weight_reps",
        equipment: str | None = None,
        video_url: str | None = None,
        is_custom: bool = True,
    ):
        self.id = id
        self.user_id = user_id
        self.name = name
        self.created_at = created_at or datetime.utcnow()
        self.muscle_group = muscle_group
        self.logging_type = logging_type
        self.equipment = equipment
        self.video_url = video_url
        self.is_custom = is_custom
