"""Request/response schemas for sharing endpoints."""
from pydantic import BaseModel, Field

from src.modules.workouts.presentation.schemas import (
    PlanDayDetailResponse,
    PlanWeekDetailResponse,
)
from src.shared.utc_datetime import UTCDatetime


class CreateShareRequest(BaseModel):
    """Request to create a plan share (POST /share)."""
    pass  # No body fields required; defaults are mode='restricted', link_permission='view'


class ShareGrantRequest(BaseModel):
    """Request to add/update a grant (POST /share/grants)."""
    username: str
    permission: str  # 'view', 'log', or 'edit'


class ShareGrantResponse(BaseModel):
    """A single grant in the list."""
    username: str
    display_name: str
    permission: str


class UpdateShareRequest(BaseModel):
    """Request to update share settings (PUT /share)."""
    mode: str | None = None  # 'restricted' or 'anyone'
    link_permission: str | None = None  # 'view', 'log', or 'edit'


class ShareResponse(BaseModel):
    """Response: the share config and list of grants."""
    id: int
    token: str
    mode: str
    link_permission: str
    created_at: UTCDatetime
    revoked_at: UTCDatetime | None
    grants: list[ShareGrantResponse] = Field(default_factory=list)


class SharedPlanShare(BaseModel):
    """Minimal share info in a shared plan response."""
    mode: str


class SharedPlanResponse(BaseModel):
    """Response for GET /api/shared/{token} — the shared plan detail with access info."""
    # Embed the full WorkoutPlanDetailResponse structure
    plan: dict  # Will be populated from WorkoutPlanDetailResponse.plan
    days: list[PlanDayDetailResponse] | None = None  # For 'days' type plans
    weeks: list[PlanWeekDetailResponse] | None = None  # For 'weeks' type plans
    # Additional sharing info
    permission: str  # 'view', 'log', or 'edit'
    plan_owner_username: str
    share: SharedPlanShare


class StartWorkoutViaShareRequest(BaseModel):
    """Request to start a workout via a shared plan (POST /api/shared/{token}/start)."""
    plan_day_id: int
    week_number: int | None = None  # For weeks-type plans


class StartWorkoutViaShareResponse(BaseModel):
    """Response for starting a workout via share."""
    session_id: int
    message: str


class AddSetViaShareRequest(BaseModel):
    """Request to add a set to a session via share (POST /api/shared/{token}/sessions/{session_id}/sets)."""
    exercise_id: int
    weight: float | None = None
    reps: int | None = None
    duration_seconds: int | None = None
    notes: str = ""


class AddSetViaShareResponse(BaseModel):
    """Response for adding a set via share."""
    set_id: int
    set_number: int


class FinishWorkoutViaShareResponse(BaseModel):
    """Response for finishing a workout via share."""
    message: str


class SharedWithMeEntry(BaseModel):
    """One entry in the current user's 'Shared with me' list."""
    plan_id: int
    plan_name: str
    token: str
    owner_username: str
    permission: str  # 'view', 'log', or 'edit' - this user's own granted tier
