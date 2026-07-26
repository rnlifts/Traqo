from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CreateWorkoutPlanRequest(BaseModel):
    """Create workout plan request schema."""

    name: str = Field(..., min_length=1, max_length=255)


class UpdateWorkoutPlanRequest(BaseModel):
    """Update workout plan request schema."""

    name: str = Field(..., min_length=1, max_length=255)


class AddExerciseRequest(BaseModel):
    """Add exercise to plan request schema."""

    exercise_id: int = Field(..., gt=0)
    target_sets: int | None = Field(None, gt=0)
    target_reps: str | None = Field(None, max_length=20)
    target_weight: float | None = Field(None, ge=0)
    target_duration_seconds: int | None = Field(None, gt=0)
    has_reps: bool = True
    has_weight: bool = True
    has_duration: bool = False


class UpdateExerciseInDayRequest(BaseModel):
    """Update exercise in plan day request schema."""

    target_sets: int | None = Field(None, gt=0)
    target_reps: str | None = Field(None, max_length=20)
    target_weight: float | None = Field(None, ge=0)
    target_duration_seconds: int | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=1000)
    has_reps: bool | None = None
    has_weight: bool | None = None
    has_duration: bool | None = None


class ReorderExerciseRequest(BaseModel):
    """Reorder exercise request schema."""

    direction: Literal["up", "down"]


class WorkoutPlanResponse(BaseModel):
    """Workout plan response schema."""

    id: int
    user_id: int
    name: str
    created_at: datetime
    updated_at: datetime


class SetTargetResponse(BaseModel):
    """Per-set target response schema."""

    set_number: int
    target_reps: str | None
    target_weight: float | None
    target_duration_seconds: int | None


class SetTargetRequest(BaseModel):
    """Per-set target request schema for updating set targets."""

    set_number: int = Field(..., gt=0)
    target_reps: str | None = Field(None, max_length=20)
    target_weight: float | None = Field(None, ge=0)
    target_duration_seconds: int | None = Field(None, gt=0)


class WorkoutExerciseResponse(BaseModel):
    """Workout exercise response schema."""

    id: int
    plan_day_id: int
    exercise_id: int
    order_number: int
    target_sets: int | None
    target_reps: str | None
    target_weight: float | None
    target_duration_seconds: int | None
    notes: str = ""
    has_reps: bool = True
    has_weight: bool = True
    has_duration: bool = False
    set_targets: list[SetTargetResponse] = []


class CreateDayRequest(BaseModel):
    """Create plan day request schema."""

    label: str = Field(..., min_length=1, max_length=255)


class UpdateDayRequest(BaseModel):
    """Update plan day request schema."""

    label: str | None = Field(None, min_length=1, max_length=255)
    is_rest: bool | None = None


class PlanDayResponse(BaseModel):
    """Plan day response schema."""

    id: int
    label: str
    order_position: int
    is_rest: bool = False
    created_at: datetime
    updated_at: datetime


class WorkoutExerciseDetailedResponse(BaseModel):
    """Workout exercise response with exercise name (for detail views)."""

    id: int
    plan_day_id: int
    exercise_id: int
    exercise_name: str
    order_number: int
    target_sets: int | None
    target_reps: str | None
    target_weight: float | None
    target_duration_seconds: int | None
    notes: str = ""
    has_reps: bool = True
    has_weight: bool = True
    has_duration: bool = False
    set_targets: list[SetTargetResponse] = []


class PlanDayDetailResponse(BaseModel):
    """Plan day with its exercises."""

    id: int
    label: str
    order_position: int
    is_rest: bool = False
    exercises: list[WorkoutExerciseDetailedResponse]
    created_at: datetime
    updated_at: datetime


class PlanWeekDetailResponse(BaseModel):
    """A week in a weeks-type plan with its effective days."""

    week_number: int
    mode: str  # 'base' | 'linked' | 'custom'
    resolved_week_number: int  # The week whose content is actually displayed
    days: list[PlanDayDetailResponse]


class WorkoutPlanDetailResponse(BaseModel):
    """Workout plan detail response."""

    class Plan(BaseModel):
        id: int
        user_id: int
        name: str
        unit_type: str | None  # 'days' | 'weeks'
        total_units: int | None
        is_quick_start: bool
        created_at: datetime
        updated_at: datetime

    plan: Plan
    days: list[PlanDayDetailResponse] | None = None  # For 'days' type plans
    weeks: list[PlanWeekDetailResponse] | None = None  # For 'weeks' type plans


class PreviousPerformanceSetResponse(BaseModel):
    """Set logged in a previous workout session."""

    set_number: int
    weight: float | None
    reps: int | None
    duration_seconds: int | None


class PreviousPerformanceExerciseResponse(BaseModel):
    """Plan-exercise instance with its sets from a previous session."""

    workout_exercise_id: int
    sets: list[PreviousPerformanceSetResponse]


class PreviousPerformanceResponse(BaseModel):
    """Previous performance data for a plan day."""

    session_date: datetime | None
    exercises: list[PreviousPerformanceExerciseResponse]


class BuildPlanExerciseRequest(BaseModel):
    """Exercise specification in a build plan request."""

    exercise_id: int = Field(..., gt=0)
    target_sets: int | None = Field(None, gt=0)
    target_reps: str | None = Field(None, max_length=20)
    target_weight: float | None = Field(None, ge=0)
    target_duration_seconds: int | None = Field(None, gt=0)
    notes: str = Field("", max_length=1000)
    has_reps: bool = True
    has_weight: bool = True
    has_duration: bool = False
    set_targets: list[SetTargetRequest] = []


class BuildPlanDayRequest(BaseModel):
    """Day specification in a build plan request."""

    label: str = Field(..., min_length=1, max_length=255)
    is_rest: bool = False
    order_position: int = Field(..., gt=0)
    exercises: list[BuildPlanExerciseRequest] = []


class BuildPlanWeekRequest(BaseModel):
    """Week specification in a build plan request (for weeks-type plans)."""

    week_number: int = Field(..., gt=0)
    mode: Literal["base", "linked", "custom"]
    days: list[BuildPlanDayRequest] | None = None


class BuildPlanRequest(BaseModel):
    """Bulk plan creation request - creates entire plan structure atomically."""

    name: str = Field(..., min_length=1, max_length=255)
    unit_type: Literal["days", "weeks"]
    total_units: int = Field(..., gt=0)
    days: list[BuildPlanDayRequest] | None = None  # For unit_type='days'
    weeks: list[BuildPlanWeekRequest] | None = None  # For unit_type='weeks'
