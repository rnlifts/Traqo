"""Endpoints for share management (owner-only)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.repositories.workout_plan_repository_impl import (
    WorkoutPlanRepositoryImpl,
)
from src.modules.sharing.infrastructure.repositories.plan_share_repository_impl import (
    PlanShareRepositoryImpl,
)
from src.modules.sharing.application.use_cases.create_or_unrevoke_share import (
    CreateOrUnrevokeShare,
)
from src.modules.sharing.application.use_cases.get_share import GetShare, ShareNotFoundError
from src.modules.sharing.application.use_cases.update_share import UpdateShare
from src.modules.sharing.application.use_cases.revoke_share import RevokeShare
from src.modules.sharing.application.use_cases.add_share_grant import (
    AddShareGrant,
    CannotGrantToSelfError,
)
from src.modules.sharing.application.use_cases.remove_share_grant import RemoveShareGrant
from .schemas import (
    CreateShareRequest,
    ShareResponse,
    ShareGrantResponse,
    ShareGrantRequest,
    UpdateShareRequest,
)

sharing_router = APIRouter(prefix="/api/workout-plans/{plan_id}/share", tags=["sharing"])


def _check_plan_ownership(plan_id: int, user_id: int, db: Session):
    """Check that the user owns the plan. Raise 403 if not, 404 if plan not found."""
    plan_repo = WorkoutPlanRepositoryImpl(db)
    plan = plan_repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )
    if plan.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this plan",
        )
    return plan


def _get_user_by_username_case_insensitive(username: str, db: Session) -> UserModel | None:
    """Look up a user by username, case-insensitive."""
    return (
        db.query(UserModel)
        .filter(func.lower(UserModel.username) == username.lower())
        .first()
    )


@sharing_router.post("", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def create_share(
    plan_id: int,
    req: CreateShareRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create the plan's share if none exists, or un-revoke if one exists (even revoked)."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    share_repo = PlanShareRepositoryImpl(db)
    use_case = CreateOrUnrevokeShare(share_repo)
    share = use_case.execute(plan_id)

    # Get grants
    grants = share_repo.list_grants(share.id)
    grant_responses = []
    for grant in grants:
        user = db.get(UserModel, grant.user_id)
        if user:
            grant_responses.append(
                ShareGrantResponse(
                    username=user.username,
                    display_name=user.display_name,
                    permission=grant.permission,
                )
            )

    return ShareResponse(
        id=share.id,
        token=share.token,
        mode=share.mode,
        link_permission=share.link_permission,
        created_at=share.created_at,
        revoked_at=share.revoked_at,
        grants=grant_responses,
    )


@sharing_router.get("", response_model=ShareResponse)
async def get_share(
    plan_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the plan's share configuration and list of grants."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    share_repo = PlanShareRepositoryImpl(db)
    use_case = GetShare(share_repo)

    try:
        share, grants = use_case.execute(plan_id)
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This plan has no share yet",
        )

    grant_responses = []
    for grant in grants:
        user = db.get(UserModel, grant.user_id)
        if user:
            grant_responses.append(
                ShareGrantResponse(
                    username=user.username,
                    display_name=user.display_name,
                    permission=grant.permission,
                )
            )

    return ShareResponse(
        id=share.id,
        token=share.token,
        mode=share.mode,
        link_permission=share.link_permission,
        created_at=share.created_at,
        revoked_at=share.revoked_at,
        grants=grant_responses,
    )


@sharing_router.put("", response_model=ShareResponse)
async def update_share(
    plan_id: int,
    req: UpdateShareRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update the plan's share mode and/or link_permission."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    # Validate mode and link_permission if provided
    if req.mode is not None and req.mode not in ("restricted", "anyone"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="mode must be 'restricted' or 'anyone'",
        )
    if req.link_permission is not None and req.link_permission not in ("view", "log", "edit"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="link_permission must be 'view', 'log', or 'edit'",
        )

    share_repo = PlanShareRepositoryImpl(db)
    use_case = UpdateShare(share_repo)

    try:
        share = use_case.execute(plan_id, req.mode, req.link_permission)
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This plan has no share yet",
        )

    # Get grants
    grants = share_repo.list_grants(share.id)
    grant_responses = []
    for grant in grants:
        user = db.get(UserModel, grant.user_id)
        if user:
            grant_responses.append(
                ShareGrantResponse(
                    username=user.username,
                    display_name=user.display_name,
                    permission=grant.permission,
                )
            )

    return ShareResponse(
        id=share.id,
        token=share.token,
        mode=share.mode,
        link_permission=share.link_permission,
        created_at=share.created_at,
        revoked_at=share.revoked_at,
        grants=grant_responses,
    )


@sharing_router.post("/revoke", response_model=ShareResponse)
async def revoke_share(
    plan_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Soft-revoke the plan's share. Idempotent."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    share_repo = PlanShareRepositoryImpl(db)
    use_case = RevokeShare(share_repo)

    try:
        share = use_case.execute(plan_id)
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This plan has no share yet",
        )

    # Get grants
    grants = share_repo.list_grants(share.id)
    grant_responses = []
    for grant in grants:
        user = db.get(UserModel, grant.user_id)
        if user:
            grant_responses.append(
                ShareGrantResponse(
                    username=user.username,
                    display_name=user.display_name,
                    permission=grant.permission,
                )
            )

    return ShareResponse(
        id=share.id,
        token=share.token,
        mode=share.mode,
        link_permission=share.link_permission,
        created_at=share.created_at,
        revoked_at=share.revoked_at,
        grants=grant_responses,
    )


@sharing_router.post("/grants", response_model=ShareGrantResponse, status_code=status.HTTP_201_CREATED)
async def add_grant(
    plan_id: int,
    req: ShareGrantRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add or update a user's grant on the plan's share."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    # Validate permission
    if req.permission not in ("view", "log", "edit"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="permission must be 'view', 'log', or 'edit'",
        )

    # Look up user by username (case-insensitive)
    target_user = _get_user_by_username_case_insensitive(req.username, db)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    share_repo = PlanShareRepositoryImpl(db)
    use_case = AddShareGrant(share_repo)

    try:
        grant = use_case.execute(plan_id, target_user.id, req.permission, user_id)
    except CannotGrantToSelfError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot grant a share to yourself",
        )
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This plan has no share yet",
        )

    return ShareGrantResponse(
        username=target_user.username,
        display_name=target_user.display_name,
        permission=grant.permission,
    )


@sharing_router.delete("/grants/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_grant(
    plan_id: int,
    username: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a user's grant from the plan's share. No error if grant doesn't exist."""
    plan = _check_plan_ownership(plan_id, user_id, db)

    # Look up user by username (case-insensitive)
    target_user = _get_user_by_username_case_insensitive(username, db)
    if not target_user:
        # 204 even if user not found (idempotent)
        return

    share_repo = PlanShareRepositoryImpl(db)
    use_case = RemoveShareGrant(share_repo)
    use_case.execute(plan_id, target_user.id)
