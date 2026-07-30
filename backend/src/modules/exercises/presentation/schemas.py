from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CreateExerciseRequest(BaseModel):
    """Create exercise request schema."""

    name: str = Field(..., min_length=1, max_length=255)
    muscle_group: str | None = None
    equipment: str | None = None
    video_url: str | None = None
    logging_type: Literal["weight_reps", "reps_only", "weight_only", "cardio"] = "weight_reps"

    @field_validator("video_url")
    @classmethod
    def validate_youtube_url(cls, v: str | None) -> str | None:
        """Validate that video_url, if provided, is a YouTube URL."""
        if not v:
            return v

        # Accept these YouTube URL shapes:
        # - https://www.youtube.com/watch?v=...
        # - https://youtube.com/watch?v=...
        # - https://m.youtube.com/watch?v=...
        # - https://youtu.be/...
        # - https://www.youtu.be/...
        valid_patterns = ["youtube.com/watch", "youtu.be/"]
        if not any(pattern in v for pattern in valid_patterns):
            raise ValueError("Please provide a valid YouTube link")

        return v


class ExerciseResponse(BaseModel):
    """Exercise response schema."""

    id: int
    name: str
    muscle_group: str | None = None
    equipment: str | None = None
    video_url: str | None = None
    logging_type: str
