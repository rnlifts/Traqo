"""Endpoints for share management (owner-only) and share access (public)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id, get_optional_user_id
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.workouts.infrastructure.repositories.workout_plan_repository_impl import (
    WorkoutPlanRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.plan_day_repository_impl import (
    PlanDayRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.plan_week_repository_impl import (
    PlanWeekRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.workout_exercise_repository_impl import (
    WorkoutExerciseRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.workout_exercise_set_target_repository_impl import (
    WorkoutExerciseSetTargetRepositoryImpl,
)
from src.modules.workouts.application.use_cases.get_workout_plan_detail import (
    GetWorkoutPlanDetail,
)
from src.modules.workouts.presentation.routes import build_plan_detail_response
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
from src.modules.sharing.application.use_cases.resolve_share_access import (
    ResolveShareAccess,
    ShareNotFoundError as AccessResolveNotFoundError,
)
from .schemas import (
    CreateShareRequest,
    ShareResponse,
    ShareGrantResponse,
    ShareGrantRequest,
    UpdateShareRequest,
    SharedPlanResponse,
    SharedPlanShare,
)

sharing_router = APIRouter(prefix="/api/workout-plans/{plan_id}/share", tags=["sharing"])
shared_plan_router = APIRouter(prefix="/api/shared", tags=["sharing"])


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


# Public shared-plan access routes (Phase 3)
@shared_plan_router.get("/{token}", response_model=SharedPlanResponse)
async def resolve_and_access_shared_plan(
    token: str,
    caller_user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Get a shared plan's details with permission-based access control.

    Auth is optional. Returns:
    - 200 with full plan detail if caller has access
    - 403 if caller lacks permission (restricted share, no grant)
    - 404 if share is missing or revoked

    Response includes:
    - Full WorkoutPlanDetailResponse (plan, days/weeks, exercises)
    - permission: the caller's effective permission tier
    - plan_owner_username: the plan owner's username
    - share: { mode }

    Note: 403 is never returned as 401 to avoid triggering frontend
    session-clear redirects. See Phase 3 spec for details.
    """
    # Initialize repositories
    share_repo = PlanShareRepositoryImpl(db)
    plan_repo = WorkoutPlanRepositoryImpl(db)

    # First, try to find the share by token
    share = share_repo.get_by_token(token)
    if not share or not share.is_active:
        # Missing or revoked share
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or no longer active",
        )

    # Get the plan from the share
    plan = plan_repo.get_by_id(share.workout_plan_id)
    if not plan:
        # This shouldn't happen (share references nonexistent plan), but be defensive
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    # Resolve access using the access resolver use case
    access_resolver = ResolveShareAccess(share_repo)
    try:
        share, effective_permission = access_resolver.execute(
            token, caller_user_id, plan_owner_user_id=plan.user_id
        )
    except AccessResolveNotFoundError as e:
        # Permission denied (e.g., restricted share with no grant, or anonymous access)
        # Check if the share is for a restricted mode without grant (should be 403)
        # vs. other errors (should be 404)
        if "anonymous access not allowed" in str(e) or "no grant for user" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this share",
            )
        else:
            # Shouldn't reach here, but catch other errors as 404
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found",
            )

    # Build the plan detail response
    day_repo = PlanDayRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    plan_detail_use_case = GetWorkoutPlanDetail(plan_repo, exercise_repo, day_repo, week_repo)

    plan_detail_response = build_plan_detail_response(
        plan, plan.id, plan_detail_use_case, exercise_repo, day_repo, week_repo, db
    )

    # Get plan owner's username
    plan_owner = db.get(UserModel, plan.user_id)
    plan_owner_username = plan_owner.username if plan_owner else "unknown"

    # Return the shared plan response
    return SharedPlanResponse(
        plan=plan_detail_response.plan.model_dump(),
        days=plan_detail_response.days,
        weeks=plan_detail_response.weeks,
        permission=effective_permission,
        plan_owner_username=plan_owner_username,
        share=SharedPlanShare(mode=share.mode),
    )
