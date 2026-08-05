"""Request/response schemas for sharing endpoints."""
from datetime import datetime
from pydantic import BaseModel, Field


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
    created_at: datetime
    revoked_at: datetime | None
    grants: list[ShareGrantResponse] = Field(default_factory=list)
