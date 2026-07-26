from typing import Literal

from pydantic import BaseModel, Field


class CreateExerciseRequest(BaseModel):
    """Create exercise request schema."""

    name: str = Field(..., min_length=1, max_length=255)
    category: Literal["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Cardio", "Full Body"] | None = None
    logging_type: Literal["weight_reps", "reps_only", "weight_only", "cardio"] = "weight_reps"


class ExerciseResponse(BaseModel):
    """Exercise response schema."""

    id: int
    name: str
    category: str | None
    logging_type: str
