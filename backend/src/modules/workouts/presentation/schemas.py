from src.shared.utc_datetime import UTCDatetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Day nicknames (e.g. "Chest Day") are meant to be a short label, not a
# paragraph -- capped at 4 words and 40 characters so a pasted wall of text
# (or one long no-space string) can't break the day-tabs layout in the UI.
DAY_CUSTOM_NAME_MAX_LENGTH = 40
DAY_CUSTOM_NAME_MAX_WORDS = 4

# Plan names (e.g. "Beginner Plan", "Weight Loss Plan") are a short title,
# not a paragraph -- same defensive intent as DAY_CUSTOM_NAME_* above, sized
# a bit more generously since real plan names run longer ("12 Week Beginner
# Full Body Strength Plan" is 7 words).
PLAN_NAME_MAX_LENGTH = 60
PLAN_NAME_MAX_WORDS = 8


def _validate_day_custom_name_word_count(value: str | None) -> str | None:
    if value and len(value.split()) > DAY_CUSTOM_NAME_MAX_WORDS:
        raise ValueError(f"custom_name must be at most {DAY_CUSTOM_NAME_MAX_WORDS} words")
    return value


def _validate_plan_name_word_count(value: str) -> str:
    if value and len(value.split()) > PLAN_NAME_MAX_WORDS:
        raise ValueError(f"name must be at most {PLAN_NAME_MAX_WORDS} words")
    return value


class CreateWorkoutPlanRequest(BaseModel):
    """Create workout plan request schema."""

    name: str = Field(..., min_length=1, max_length=PLAN_NAME_MAX_LENGTH)

    _validate_name_word_count = field_validator("name")(_validate_plan_name_word_count)


class UpdateWorkoutPlanRequest(BaseModel):
    """Update workout plan request schema."""

    name: str = Field(..., min_length=1, max_length=PLAN_NAME_MAX_LENGTH)

    _validate_name_word_count = field_validator("name")(_validate_plan_name_word_count)


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
    created_at: UTCDatetime
    updated_at: UTCDatetime


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
    # Optional nickname shown alongside `label` (e.g. "Chest Day"), not a
    # replacement for it. None means leave unchanged; "" clears it to unset.
    custom_name: str | None = Field(None, max_length=DAY_CUSTOM_NAME_MAX_LENGTH)

    _validate_custom_name_word_count = field_validator("custom_name")(_validate_day_custom_name_word_count)


class PlanDayResponse(BaseModel):
    """Plan day response schema."""

    id: int
    label: str
    order_position: int
    is_rest: bool = False
    custom_name: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


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
    video_url: str | None = None
    muscle_group: str | None = None
    equipment: str | None = None
    set_targets: list[SetTargetResponse] = []


class PlanDayDetailResponse(BaseModel):
    """Plan day with its exercises."""

    id: int
    label: str
    order_position: int
    is_rest: bool = False
    custom_name: str | None = None
    exercises: list[WorkoutExerciseDetailedResponse]
    created_at: UTCDatetime
    updated_at: UTCDatetime


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
        created_at: UTCDatetime
        updated_at: UTCDatetime

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

    session_date: UTCDatetime | None
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
    # Optional nickname (e.g. "Chest Day") shown alongside `label`, not a
    # replacement for it.
    custom_name: str | None = Field(None, max_length=DAY_CUSTOM_NAME_MAX_LENGTH)

    _validate_custom_name_word_count = field_validator("custom_name")(_validate_day_custom_name_word_count)


class BuildPlanWeekRequest(BaseModel):
    """Week specification in a build plan request (for weeks-type plans)."""

    week_number: int = Field(..., gt=0)
    mode: Literal["base", "linked", "custom"]
    days: list[BuildPlanDayRequest] | None = None


class BuildPlanRequest(BaseModel):
    """Bulk plan creation request - creates entire plan structure atomically."""

    name: str = Field(..., min_length=1, max_length=PLAN_NAME_MAX_LENGTH)
    unit_type: Literal["days", "weeks"]
    total_units: int = Field(..., gt=0)
    days: list[BuildPlanDayRequest] | None = None  # For unit_type='days'
    weeks: list[BuildPlanWeekRequest] | None = None  # For unit_type='weeks'

    _validate_name_word_count = field_validator("name")(_validate_plan_name_word_count)
