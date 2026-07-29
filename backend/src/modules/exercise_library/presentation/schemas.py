from pydantic import BaseModel


class LibraryExerciseResponse(BaseModel):
    """Exercise library item for API responses."""

    id: int
    name: str
    muscle_group: str
    equipment: str | None = None
    thumbnail_url: str | None = None


class MuscleGroupsResponse(BaseModel):
    """List of muscle groups."""

    muscle_groups: list[str]
