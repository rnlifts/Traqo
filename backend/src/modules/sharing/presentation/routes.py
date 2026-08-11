"""Endpoints for share management (owner-only) and share access (public)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id, get_optional_user_id
from src.modules.auth.infrastructure.repositories.user_repository_impl import (
    UserRepositoryImpl,
)
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
from src.modules.sharing.application.use_cases.get_share import GetShare
from src.modules.sharing.application.use_cases.update_share import UpdateShare
from src.modules.sharing.application.use_cases.revoke_share import RevokeShare
from src.modules.sharing.application.use_cases.add_share_grant import (
    AddShareGrant,
    CannotGrantToSelfError,
)
from src.modules.sharing.application.use_cases.remove_share_grant import RemoveShareGrant
from src.modules.sharing.application.use_cases.resolve_share_access import ResolveShareAccess
from src.modules.sharing.application.use_cases.list_shared_with_me import ListSharedWithMe
from src.modules.sharing.domain.exceptions import (
    ShareNotFoundError,
    ShareAccessDeniedError,
    InvalidShareConfigurationError,
)
from . import schemas
from .schemas import (
    CreateShareRequest,
    ShareResponse,
    ShareGrantResponse,
    ShareGrantRequest,
    UpdateShareRequest,
    SharedPlanResponse,
    SharedPlanShare,
    StartWorkoutViaShareRequest,
    StartWorkoutViaShareResponse,
    AddSetViaShareRequest,
    AddSetViaShareResponse,
    FinishWorkoutViaShareResponse,
    SharedWithMeEntry,
)

sharing_router = APIRouter(prefix="/api/workout-plans/{plan_id}/share", tags=["sharing"])
shared_plan_router = APIRouter(prefix="/api/shared", tags=["sharing"])
# Separate top-level path, not nested under /api/shared/ - that prefix's {token}
# path parameter would otherwise swallow any sub-path here as a literal token value.
shared_with_me_router = APIRouter(prefix="/api/shared-with-me", tags=["sharing"])


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
    user_repo = UserRepositoryImpl(db)
    use_case = CreateOrUnrevokeShare(share_repo)
    share = use_case.execute(plan_id)

    # Get grants
    grants = share_repo.list_grants(share.id)
    grant_responses = []
    for grant in grants:
        user = user_repo.get_by_id(grant.user_id)
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
    user_repo = UserRepositoryImpl(db)
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
        user = user_repo.get_by_id(grant.user_id)
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
    user_repo = UserRepositoryImpl(db)
    use_case = UpdateShare(share_repo)

    try:
        share = use_case.execute(plan_id, req.mode, req.link_permission)
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This plan has no share yet",
        )
    except InvalidShareConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    # Get grants
    grants = share_repo.list_grants(share.id)
    grant_responses = []
    for grant in grants:
        user = user_repo.get_by_id(grant.user_id)
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
    user_repo = UserRepositoryImpl(db)
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
        user = user_repo.get_by_id(grant.user_id)
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
    target_user = UserRepositoryImpl(db).get_by_username_case_insensitive(req.username)
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
    target_user = UserRepositoryImpl(db).get_by_username_case_insensitive(username)
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
    except ShareAccessDeniedError:
        # Access denied: restricted share with no grant, or anonymous on restricted
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this share",
        )
    except ShareNotFoundError:
        # Share is missing or revoked
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
    plan_owner = UserRepositoryImpl(db).get_by_id(plan.user_id)
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


# Phase 4: Logging through a share (attribution)
@shared_plan_router.post("/{token}/start", response_model=schemas.StartWorkoutViaShareResponse, status_code=status.HTTP_201_CREATED)
async def start_workout_via_share(
    token: str,
    req: schemas.StartWorkoutViaShareRequest,
    caller_user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Start a workout session via a shared plan (auth optional).

    Attribution rules:
    - Authenticated caller: session.user_id = caller, share_id = share.id, logged_by_user_id = caller
    - Anonymous caller (anyone mode only): session.user_id = plan_owner, share_id = share.id, logged_by_user_id = NULL

    Requires effective permission >= 'log' (403 otherwise).
    """
    from src.modules.sessions.application.use_cases.start_workout import StartWorkout
    from src.modules.sessions.infrastructure.repositories.workout_session_repository_impl import WorkoutSessionRepositoryImpl as SessionRepoImpl
    from src.modules.workouts.infrastructure.repositories.workout_plan_repository_impl import WorkoutPlanRepositoryImpl

    # Initialize repositories
    share_repo = PlanShareRepositoryImpl(db)
    plan_repo = WorkoutPlanRepositoryImpl(db)

    # Fetch the share and plan first so we know the real owner before resolving
    # access — resolving with a placeholder owner would make the "is this caller
    # the plan owner" check unable to ever match, which could wrongly deny the
    # plan owner access to their own restricted-mode share link.
    share = share_repo.get_by_token(token)
    if not share or not share.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    plan = plan_repo.get_by_id(share.workout_plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    # Resolve access with the real plan owner
    access_resolver = ResolveShareAccess(share_repo)
    try:
        share, effective_permission = access_resolver.execute(
            token, caller_user_id, plan_owner_user_id=plan.user_id
        )
    except ShareAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this share",
        )
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Check permission >= 'log'
    if effective_permission not in ("log", "edit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to log workouts through this share",
        )

    # Determine session ownership and attribution based on authentication
    if caller_user_id is not None:
        # Authenticated: session belongs to caller, logged_by = caller
        session_user_id = caller_user_id
        logged_by_user_id = caller_user_id
    else:
        # Anonymous: session belongs to plan owner, logged_by = NULL
        session_user_id = plan.user_id
        logged_by_user_id = None

    # Start the session via share
    session_repo = SessionRepoImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    use_case = StartWorkout(plan_repo, session_repo, week_repo, day_repo)

    session = use_case.execute(
        user_id=session_user_id,
        workout_plan_id=share.workout_plan_id,
        plan_day_id=req.plan_day_id,
        week_number=req.week_number,
        share_id=share.id,
        logged_by_user_id=logged_by_user_id,
        skip_ownership_check=True,
    )

    return schemas.StartWorkoutViaShareResponse(
        session_id=session.id,
        message="Workout started via share",
    )


@shared_plan_router.post("/{token}/sessions/{session_id}/sets", response_model=schemas.AddSetViaShareResponse, status_code=status.HTTP_201_CREATED)
async def add_set_via_share(
    token: str,
    session_id: int,
    req: schemas.AddSetViaShareRequest,
    caller_user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Add a set to a session via a shared plan token (auth optional).

    Token-scoped endpoint for anonymous logging. Authenticated callers should use
    the normal /api/workout-sessions/{session_id}/sets endpoint.

    Verifies the session's share_id matches the resolved share's id and permission >= 'log'.
    """
    from src.modules.sessions.infrastructure.repositories.workout_session_repository_impl import WorkoutSessionRepositoryImpl as SessionRepoImpl
    from src.modules.sessions.infrastructure.repositories.workout_set_repository_impl import WorkoutSetRepositoryImpl
    from src.modules.workouts.infrastructure.repositories.workout_exercise_repository_impl import WorkoutExerciseRepositoryImpl
    from src.modules.exercises.infrastructure.repositories.exercise_repository_impl import ExerciseRepositoryImpl
    from src.modules.sessions.application.use_cases.add_workout_set import AddWorkoutSet

    # Fetch the share and plan first so we know the real owner before resolving
    # access — resolving with a placeholder owner would make the "is this caller
    # the plan owner" check unable to ever match, which could wrongly deny the
    # plan owner access to their own restricted-mode share link.
    share_repo = PlanShareRepositoryImpl(db)
    share = share_repo.get_by_token(token)
    if not share or not share.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    plan_repo = WorkoutPlanRepositoryImpl(db)
    plan = plan_repo.get_by_id(share.workout_plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    # Resolve access with the real plan owner
    access_resolver = ResolveShareAccess(share_repo)
    try:
        share, effective_permission = access_resolver.execute(
            token, caller_user_id, plan_owner_user_id=plan.user_id
        )
    except ShareAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this share",
        )
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Check permission >= 'log'
    if effective_permission not in ("log", "edit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to log workouts through this share",
        )

    # Get the session and verify it belongs to this share
    session_repo = SessionRepoImpl(db)
    session = session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.share_id != share.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this share",
        )

    # Get the workout_exercise by finding the exercise in the session's plan day
    exercise_repo = ExerciseRepositoryImpl(db)
    exercise = exercise_repo.get_by_id(req.exercise_id)
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found",
        )

    # Find the workout_exercise for this exercise in the session's plan day
    workout_exercise_repo = WorkoutExerciseRepositoryImpl(db)
    workout_exercises = workout_exercise_repo.list_by_day(session.plan_day_id)
    workout_exercise = None
    for we in workout_exercises:
        if we.exercise_id == req.exercise_id:
            workout_exercise = we
            break

    if not workout_exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found in this workout day",
        )

    # Add the set using the normal use case (but with the session owner, not caller)
    set_repo = WorkoutSetRepositoryImpl(db)
    use_case = AddWorkoutSet(session_repo, set_repo, exercise_repo, workout_exercise_repo)

    # Calculate next set number for this exercise in this session
    next_set_number = set_repo.count_by_session_and_exercise(session_id, workout_exercise.id) + 1

    workout_set = use_case.execute(
        user_id=session.user_id,  # Use session owner, not caller
        session_id=session_id,
        workout_exercise_id=workout_exercise.id,
        set_number=next_set_number,
        weight=req.weight,
        reps=req.reps,
        duration_seconds=req.duration_seconds,
        notes=req.notes,
        skip_exercise_ownership_check=True,  # Permission was already verified via share resolution
    )

    return schemas.AddSetViaShareResponse(
        set_id=workout_set.id,
        set_number=workout_set.set_number,
    )


@shared_plan_router.post("/{token}/sessions/{session_id}/finish", response_model=schemas.FinishWorkoutViaShareResponse)
async def finish_workout_via_share(
    token: str,
    session_id: int,
    caller_user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Finish a workout session via a shared plan token (auth optional).

    Token-scoped endpoint for anonymous logging. Authenticated callers should use
    the normal /api/workout-sessions/{session_id}/finish endpoint.

    Verifies the session's share_id matches the resolved share's id and permission >= 'log'.
    """
    from src.modules.sessions.infrastructure.repositories.workout_session_repository_impl import WorkoutSessionRepositoryImpl as SessionRepoImpl
    from src.modules.sessions.application.use_cases.finish_workout import FinishWorkout

    # Fetch the share and plan first so we know the real owner before resolving
    # access — resolving with a placeholder owner would make the "is this caller
    # the plan owner" check unable to ever match, which could wrongly deny the
    # plan owner access to their own restricted-mode share link.
    share_repo = PlanShareRepositoryImpl(db)
    share = share_repo.get_by_token(token)
    if not share or not share.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    plan_repo = WorkoutPlanRepositoryImpl(db)
    plan = plan_repo.get_by_id(share.workout_plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    # Resolve access with the real plan owner
    access_resolver = ResolveShareAccess(share_repo)
    try:
        share, effective_permission = access_resolver.execute(
            token, caller_user_id, plan_owner_user_id=plan.user_id
        )
    except ShareAccessDeniedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this share",
        )
    except ShareNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found",
        )

    # Check permission >= 'log'
    if effective_permission not in ("log", "edit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to log workouts through this share",
        )

    # Get the session and verify it belongs to this share
    session_repo = SessionRepoImpl(db)
    session = session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.share_id != share.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this share",
        )

    # Finish the session using the normal use case (but with the session owner, not caller)
    use_case = FinishWorkout(session_repo)
    use_case.execute(user_id=session.user_id, session_id=session_id)

    return schemas.FinishWorkoutViaShareResponse(
        message="Workout completed",
    )


@shared_with_me_router.get("", response_model=list[SharedWithMeEntry])
async def list_shared_with_me(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List every plan shared with the current user via an explicit username grant.

    Grant-based, not mode-based - a plan appears here because someone specifically
    granted this user access, regardless of the share's overall mode. Revoked
    shares (and grants on them) are excluded by the repository query. If the
    underlying plan was deleted (share cascades with it), that grant simply won't
    appear here at all - not treated as an error case.
    """
    share_repo = PlanShareRepositoryImpl(db)
    plan_repo = WorkoutPlanRepositoryImpl(db)
    user_repo = UserRepositoryImpl(db)
    use_case = ListSharedWithMe(share_repo)

    pairs = use_case.execute(user_id)

    entries = []
    for grant, share in pairs:
        plan = plan_repo.get_by_id(share.workout_plan_id)
        if not plan:
            continue
        owner = user_repo.get_by_id(plan.user_id)
        entries.append(
            SharedWithMeEntry(
                plan_id=plan.id,
                plan_name=plan.name,
                token=share.token,
                owner_username=owner.username if owner else "unknown",
                permission=grant.permission,
            )
        )
    return entries
