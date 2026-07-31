from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CreateExerciseRequest(BaseModel):
    """Create exercise request schema."""

    name: str = Field(..., min_length=1, max_length=255)
    muscle_group: str | None = None
    logging_type: Literal["weight_reps", "reps_only", "weight_only", "cardio"] = "weight_reps"
    equipment: str | None = None
    video_url: str | None = None
    is_custom: bool = True

    @field_validator("video_url")
    @classmethod
    def validate_video_url(cls, v: str | None) -> str | None:
        """Validate that video_url is either None or contains YouTube URL patterns."""
        if v is None or v == "":
            return v

        # Check if URL contains YouTube patterns
        if "youtube.com/watch" not in v and "youtu.be/" not in v:
            raise ValueError("video_url must be a YouTube URL (youtube.com/watch or youtu.be/)")

        return v


class UpdateExerciseRequest(BaseModel):
    """Update exercise request schema."""

    name: str = Field(..., min_length=1, max_length=255)
    muscle_group: str | None = None
    equipment: str | None = None
    video_url: str | None = None

    @field_validator("video_url")
    @classmethod
    def validate_video_url(cls, v: str | None) -> str | None:
        """Validate that video_url is either None or contains YouTube URL patterns."""
        if v is None or v == "":
            return v

        # Check if URL contains YouTube patterns
        if "youtube.com/watch" not in v and "youtu.be/" not in v:
            raise ValueError("video_url must be a YouTube URL (youtube.com/watch or youtu.be/)")

        return v


class ExerciseResponse(BaseModel):
    """Exercise response schema."""

    id: int
    name: str
    muscle_group: str | None
    logging_type: str
    equipment: str | None = None
    video_url: str | None = None
    is_custom: bool
