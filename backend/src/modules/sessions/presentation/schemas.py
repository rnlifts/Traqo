from datetime import datetime

from pydantic import BaseModel, Field


class StartWorkoutRequest(BaseModel):
    """Request to start a workout session."""

    workout_plan_id: int = Field(..., gt=0)
    plan_day_id: int | None = Field(None, gt=0)


class WorkoutSessionResponse(BaseModel):
    """Workout session response."""

    id: int
    user_id: int
    workout_plan_id: int
    plan_day_id: int | None
    started_at: datetime
    completed_at: datetime | None


class AddWorkoutSetRequest(BaseModel):
    """Request to log a workout set."""

    exercise_id: int = Field(..., gt=0)
    weight: float = Field(..., gt=0)
    reps: int = Field(..., gt=0)
    notes: str = Field(default="", max_length=500)


class WorkoutSetResponse(BaseModel):
    """Workout set response."""

    id: int
    workout_session_id: int
    exercise_id: int
    set_number: int
    weight: float
    reps: int
    notes: str


class WorkoutSessionDetailResponse(BaseModel):
    """Full session detail with all logged sets."""

    class Session(BaseModel):
        id: int
        user_id: int
        workout_plan_id: int
        plan_day_id: int | None
        started_at: datetime
        completed_at: datetime | None

    session: Session
    sets: list[WorkoutSetResponse]


class FinishWorkoutResponse(BaseModel):
    """Response after finishing a workout."""

    message: str


class StartWorkoutResponse(BaseModel):
    """Response after starting a workout."""

    session_id: int
    message: str


class WorkoutHistoryEntryResponse(BaseModel):
    """A single workout history entry."""

    date: datetime
    workout: str
    duration: str
