from datetime import datetime

from pydantic import BaseModel, Field


class StartWorkoutRequest(BaseModel):
    """Request to start a workout session."""

    workout_plan_id: int = Field(..., gt=0)
    plan_day_id: int | None = Field(None, gt=0)
    week_number: int | None = Field(None, ge=1)  # For weeks-type plans: the week number (1-indexed)


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

    workout_exercise_id: int = Field(..., gt=0)
    set_number: int = Field(..., gt=0)
    weight: float | None = Field(default=None, gt=0)
    reps: int | None = Field(default=None, gt=0)
    duration_seconds: int | None = Field(default=None, gt=0)
    notes: str = Field(default="", max_length=500)


class WorkoutSetResponse(BaseModel):
    """Workout set response."""

    id: int
    workout_session_id: int
    exercise_id: int
    workout_exercise_id: int | None
    set_number: int
    weight: float | None
    reps: int | None
    duration_seconds: int | None
    notes: str


class WorkoutSetWithExerciseResponse(BaseModel):
    """Workout set with exercise name (used in session detail drill-down only)."""

    id: int
    exercise_id: int
    workout_exercise_id: int | None
    exercise_name: str
    set_number: int
    weight: float | None
    reps: int | None
    duration_seconds: int | None
    notes: str


class WorkoutSessionDetailResponse(BaseModel):
    """Full session detail with all logged sets."""

    class Session(BaseModel):
        id: int
        user_id: int
        workout_plan_id: int
        plan_name: str
        plan_day_id: int | None
        day_label: str | None
        plan_week_id: int | None
        week_number: int | None
        started_at: datetime
        completed_at: datetime | None
        duration_minutes: int | None

    session: Session
    sets: list[WorkoutSetWithExerciseResponse]


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
    session_id: int


class ProgressSetResponse(BaseModel):
    """A single set in an exercise progress view."""

    set_number: int
    weight: float
    reps: int
    notes: str
    estimated_1rm: float
    is_weight_pr: bool
    is_reps_pr: bool
    is_e1rm_pr: bool


class ProgressSessionEntryResponse(BaseModel):
    """A single session's worth of sets for an exercise in progress view."""

    session_id: int
    date: datetime
    sets: list[ProgressSetResponse]
    volume: float
    is_volume_pr: bool


class PersonalRecordsResponse(BaseModel):
    """Personal records for an exercise."""

    heaviest_weight: float | None
    heaviest_weight_date: datetime | None
    best_estimated_1rm: float | None
    best_estimated_1rm_date: datetime | None
    best_volume: float | None
    best_volume_date: datetime | None
    most_reps: int | None
    most_reps_date: datetime | None


class ExerciseProgressResponse(BaseModel):
    """Complete progress data for an exercise."""

    exercise_id: int
    exercise_name: str
    sessions: list[ProgressSessionEntryResponse]
    personal_records: PersonalRecordsResponse


class UnresolvedSessionResponse(BaseModel):
    """Enriched unresolved session with resolved metadata."""

    session: WorkoutSessionResponse
    plan_name: str
    day_label: str | None
    week_number: int | None


class GetUnresolvedSessionResponse(BaseModel):
    """Response containing unresolved session or null."""

    session: UnresolvedSessionResponse | None
