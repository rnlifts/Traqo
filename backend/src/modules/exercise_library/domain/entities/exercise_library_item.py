from datetime import datetime


class ExerciseLibraryItem:
    """A global, curated exercise in the library (read-only from user perspective)."""

    def __init__(
        self,
        name: str,
        muscle_group: str,
        equipment: str | None = None,
        video_url: str | None = None,
        image_url: str | None = None,
        id: int | None = None,
        created_at: datetime | None = None,
    ):
        self.id = id
        self.name = name
        self.muscle_group = muscle_group
        self.equipment = equipment
        self.video_url = video_url
        self.image_url = image_url
        self.created_at = created_at or datetime.utcnow()
