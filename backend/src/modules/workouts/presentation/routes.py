from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id
from src.modules.exercises.infrastructure.repositories.exercise_repository_impl import (
    ExerciseRepositoryImpl,
)
from src.modules.sessions.infrastructure.repositories.workout_session_repository_impl import (
    WorkoutSessionRepositoryImpl,
)
from src.modules.sessions.infrastructure.repositories.workout_set_repository_impl import (
    WorkoutSetRepositoryImpl,
)
from src.modules.sessions.application.use_cases.get_previous_performance import (
    GetPreviousPerformance,
)
from src.modules.workouts.application.use_cases.add_exercise_to_day import (
    AddExerciseToDay,
)
from src.modules.workouts.application.use_cases.create_day import CreateDay
from src.modules.workouts.application.use_cases.create_workout_plan import (
    CreateWorkoutPlan,
)
from src.modules.workouts.application.use_cases.delete_day import DeleteDay
from src.modules.workouts.application.use_cases.delete_workout_plan import (
    DeleteWorkoutPlan,
)
from src.modules.workouts.application.use_cases.get_workout_plan_detail import (
    GetWorkoutPlanDetail,
)
from src.modules.workouts.application.use_cases.list_days_for_plan import (
    ListDaysForPlan,
)
from src.modules.workouts.application.use_cases.list_workout_plans import (
    ListWorkoutPlans,
)
from src.modules.workouts.application.use_cases.remove_exercise_from_day import (
    RemoveExerciseFromDay,
)
from src.modules.workouts.application.use_cases.reorder_day_exercise import (
    ReorderDayExercise,
)
from src.modules.workouts.application.use_cases.update_day import UpdateDay
from src.modules.workouts.application.use_cases.update_workout_plan import (
    UpdateWorkoutPlan,
)
from src.modules.workouts.application.use_cases.customize_week import (
    CustomizeWeek,
)
from src.modules.workouts.application.use_cases.match_previous_week import (
    MatchPreviousWeek,
)
from src.modules.workouts.application.use_cases.update_exercise_in_day import (
    UpdateExerciseInDay,
)
from src.modules.workouts.application.use_cases.build_plan import (
    BuildPlan,
    BuildPlanDaySpec,
    BuildPlanWeekSpec,
)
from src.modules.workouts.domain.exceptions import (
    InvalidWeekModeError,
    TotalUnitsMismatchError,
    LinkedWeekWithDaysError,
    InvalidPlanStructureError,
    ExerciseNotOwnedError,
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
from src.modules.workouts.infrastructure.repositories.workout_plan_repository_impl import (
    WorkoutPlanRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.workout_exercise_set_target_repository_impl import (
    WorkoutExerciseSetTargetRepositoryImpl,
)
from .schemas import (
    CreateDayRequest,
    CreateWorkoutPlanRequest,
    PlanDayDetailResponse,
    PlanDayResponse,
    ReorderExerciseRequest,
    UpdateDayRequest,
    UpdateWorkoutPlanRequest,
    WorkoutPlanDetailResponse,
    WorkoutPlanResponse,
    WorkoutExerciseResponse,
    AddExerciseRequest,
    UpdateExerciseInDayRequest,
    WorkoutExerciseDetailedResponse,
    PreviousPerformanceResponse,
    PreviousPerformanceExerciseResponse,
    PreviousPerformanceSetResponse,
    BuildPlanRequest,
    SetTargetResponse,
    SetTargetRequest,
)

workouts_router = APIRouter(prefix="/api/workout-plans", tags=["workouts"])


def _build_workout_exercise_response(
    exercise, db: Session, include_exercise_name: bool = False
) -> WorkoutExerciseResponse | WorkoutExerciseDetailedResponse:
    """Helper to build a WorkoutExerciseResponse with set_targets populated.

    Args:
        exercise: The WorkoutExercise domain entity.
        db: Database session to fetch set targets.
        include_exercise_name: If True, return WorkoutExerciseDetailedResponse; else WorkoutExerciseResponse.

    Returns:
        WorkoutExerciseResponse or WorkoutExerciseDetailedResponse with set_targets populated.
    """
    # Fetch set targets for this exercise
    set_target_repo = WorkoutExerciseSetTargetRepositoryImpl(db)
    set_targets = set_target_repo.list_by_workout_exercise(exercise.id)
    set_targets_responses = [
        SetTargetResponse(
            set_number=st.set_number,
            target_reps=st.target_reps,
            target_weight=st.target_weight,
            target_duration_seconds=st.target_duration_seconds,
        )
        for st in set_targets
    ]

    if include_exercise_name:
        exercise_domain_repo = ExerciseRepositoryImpl(db)
        exercise_entity = exercise_domain_repo.get_by_id(exercise.exercise_id)
        exercise_name = exercise_entity.name if exercise_entity else "Unknown Exercise"
        return WorkoutExerciseDetailedResponse(
            id=exercise.id,
            plan_day_id=exercise.plan_day_id,
            exercise_id=exercise.exercise_id,
            exercise_name=exercise_name,
            order_number=exercise.order_number,
            target_sets=exercise.target_sets,
            target_reps=exercise.target_reps,
            target_weight=exercise.target_weight,
            target_duration_seconds=exercise.target_duration_seconds,
            notes=exercise.notes,
            has_reps=exercise.has_reps,
            has_weight=exercise.has_weight,
            has_duration=exercise.has_duration,
            set_targets=set_targets_responses,
        )
    else:
        return WorkoutExerciseResponse(
            id=exercise.id,
            plan_day_id=exercise.plan_day_id,
            exercise_id=exercise.exercise_id,
            order_number=exercise.order_number,
            target_sets=exercise.target_sets,
            target_reps=exercise.target_reps,
            target_weight=exercise.target_weight,
            target_duration_seconds=exercise.target_duration_seconds,
            notes=exercise.notes,
            has_reps=exercise.has_reps,
            has_weight=exercise.has_weight,
            has_duration=exercise.has_duration,
            set_targets=set_targets_responses,
        )


@workouts_router.post("", response_model=WorkoutPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_workout_plan(
    req: CreateWorkoutPlanRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    use_case = CreateWorkoutPlan(plan_repo)
    plan = use_case.execute(user_id, req.name)
    return plan


@workouts_router.post("/build", response_model=WorkoutPlanDetailResponse, status_code=status.HTTP_201_CREATED)
async def build_plan(
    req: BuildPlanRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Bulk create a complete workout plan with all structure in one atomic operation.

    This endpoint accepts a full plan specification (name, unit_type, total_units,
    and either days or weeks with all their exercises) and creates everything
    together. If any validation fails, nothing is persisted.

    Request body structure for days-type plan:
    {
      "name": "Off-season strength block",
      "unit_type": "days",
      "total_units": 2,
      "days": [
        {
          "label": "Day 1", "is_rest": false, "order_position": 1,
          "exercises": [
            {"exercise_id": 66, "target_sets": 3, "target_reps": 8, "target_weight": 135, "notes": "pause at bottom"}
          ]
        },
        {"label": "Day 2", "is_rest": true, "order_position": 2, "exercises": []}
      ]
    }

    Request body structure for weeks-type plan:
    {
      "name": "PPL 4-week block",
      "unit_type": "weeks",
      "total_units": 4,
      "weeks": [
        {"week_number": 1, "mode": "base", "days": [...]},
        {"week_number": 2, "mode": "linked"},
        {"week_number": 3, "mode": "custom", "days": [...]},
        {"week_number": 4, "mode": "linked"}
      ]
    }

    Validation:
    - All exercise_ids must belong to the requesting user
    - For weeks plans: week 1 must have mode='base', only one week can be base
    - Linked weeks must not include days
    - total_units must match the provided days/weeks count

    Returns the complete plan structure as if fetched via GET /api/workout-plans/{id}.
    """
    exercise_repo = ExerciseRepositoryImpl(db)

    # Convert request to use case specs
    days_spec = None
    weeks_spec = None

    if req.unit_type == "days":
        if not req.days:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="days-type plan must include 'days' array",
            )
        days_spec = [
            BuildPlanDaySpec(
                label=day.label,
                is_rest=day.is_rest,
                order_position=day.order_position,
                exercises=[
                    {
                        "exercise_id": ex.exercise_id,
                        "target_sets": ex.target_sets,
                        "target_reps": ex.target_reps,
                        "target_weight": ex.target_weight,
                        "target_duration_seconds": ex.target_duration_seconds,
                        "notes": ex.notes,
                        "has_reps": ex.has_reps,
                        "has_weight": ex.has_weight,
                        "has_duration": ex.has_duration,
                        "set_targets": [st.dict() for st in ex.set_targets],
                    }
                    for ex in day.exercises
                ],
            )
            for day in req.days
        ]
    elif req.unit_type == "weeks":
        if not req.weeks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="weeks-type plan must include 'weeks' array",
            )
        weeks_spec = [
            BuildPlanWeekSpec(
                week_number=week.week_number,
                mode=week.mode,
                days=(
                    [
                        BuildPlanDaySpec(
                            label=day.label,
                            is_rest=day.is_rest,
                            order_position=day.order_position,
                            exercises=[
                                {
                                    "exercise_id": ex.exercise_id,
                                    "target_sets": ex.target_sets,
                                    "target_reps": ex.target_reps,
                                    "target_weight": ex.target_weight,
                                    "target_duration_seconds": ex.target_duration_seconds,
                                    "notes": ex.notes,
                                    "has_reps": ex.has_reps,
                                    "has_weight": ex.has_weight,
                                    "has_duration": ex.has_duration,
                                    "set_targets": [st.dict() for st in ex.set_targets],
                                }
                                for ex in day.exercises
                            ],
                        )
                        for day in (week.days or [])
                    ]
                    if week.days
                    else None
                ),
            )
            for week in req.weeks
        ]

    # Execute use case with error handling
    use_case = BuildPlan(db, exercise_repo)
    try:
        plan = use_case.execute(
            user_id=user_id,
            name=req.name,
            unit_type=req.unit_type,
            total_units=req.total_units,
            days_spec=days_spec,
            weeks_spec=weeks_spec,
        )
    except InvalidWeekModeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except TotalUnitsMismatchError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except LinkedWeekWithDaysError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except InvalidPlanStructureError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ExerciseNotOwnedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Return the full plan detail (same format as GET /api/workout-plans/{id})
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    exercise_detail_repo = WorkoutExerciseRepositoryImpl(db)
    exercise_domain_repo = ExerciseRepositoryImpl(db)

    detail_use_case = GetWorkoutPlanDetail(
        plan_repo, exercise_detail_repo, day_repo, week_repo
    )
    plan, _ = detail_use_case.execute(plan.id, user_id)

    # Helper function to build day detail responses (reuse from get_workout_plan_detail)
    def build_day_response(day):
        exercises = exercise_detail_repo.list_by_day(day.id)
        exercise_responses = []
        for ex in exercises:
            exercise_responses.append(_build_workout_exercise_response(ex, db, include_exercise_name=True))
        return PlanDayDetailResponse(
            id=day.id,
            label=day.label,
            order_position=day.order_position,
            is_rest=day.is_rest,
            exercises=exercise_responses,
            created_at=day.created_at,
            updated_at=day.updated_at,
        )

    # Build response based on plan type
    if plan.unit_type == "weeks":
        from .schemas import PlanWeekDetailResponse

        weeks_detail = []
        for week_num in range(1, (plan.total_units or 0) + 1):
            effective_week_data = detail_use_case.get_effective_week(plan.id, week_num)
            if effective_week_data:
                week = week_repo.get_by_plan_and_week_number(plan.id, week_num)
                days_responses = [
                    build_day_response(day) for day in effective_week_data["days"]
                ]
                weeks_detail.append(
                    PlanWeekDetailResponse(
                        week_number=week_num,
                        mode=week.mode,
                        resolved_week_number=effective_week_data["resolved_week_number"],
                        days=days_responses,
                    )
                )

        return WorkoutPlanDetailResponse(
            plan=WorkoutPlanDetailResponse.Plan(
                id=plan.id,
                user_id=plan.user_id,
                name=plan.name,
                unit_type=plan.unit_type,
                total_units=plan.total_units,
                is_quick_start=plan.is_quick_start,
                created_at=plan.created_at,
                updated_at=plan.updated_at,
            ),
            weeks=weeks_detail,
            days=None,
        )
    else:
        # For days-type plans, return flat day list
        days = day_repo.list_by_plan(plan.id)
        days_detail = [build_day_response(day) for day in days]

        return WorkoutPlanDetailResponse(
            plan=WorkoutPlanDetailResponse.Plan(
                id=plan.id,
                user_id=plan.user_id,
                name=plan.name,
                unit_type=plan.unit_type,
                total_units=plan.total_units,
                is_quick_start=plan.is_quick_start,
                created_at=plan.created_at,
                updated_at=plan.updated_at,
            ),
            days=days_detail,
            weeks=None,
        )


@workouts_router.get("", response_model=list[WorkoutPlanResponse])
async def list_workout_plans(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    use_case = ListWorkoutPlans(plan_repo)
    plans = use_case.execute(user_id)
    return plans


@workouts_router.get("/{plan_id}", response_model=WorkoutPlanDetailResponse)
async def get_workout_plan_detail(
    plan_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    exercise_domain_repo = ExerciseRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)

    use_case = GetWorkoutPlanDetail(plan_repo, exercise_repo, day_repo, week_repo)
    plan, _ = use_case.execute(plan_id, user_id)

    # Helper function to build day detail responses
    def build_day_response(day):
        exercises = exercise_repo.list_by_day(day.id)
        exercise_responses = []
        for ex in exercises:
            exercise_responses.append(_build_workout_exercise_response(ex, db, include_exercise_name=True))
        return PlanDayDetailResponse(
            id=day.id,
            label=day.label,
            order_position=day.order_position,
            is_rest=day.is_rest,
            exercises=exercise_responses,
            created_at=day.created_at,
            updated_at=day.updated_at,
        )

    # Handle weeks-type vs days-type plans differently
    if plan.unit_type == "weeks":
        # Resolve each week's effective days
        from .schemas import PlanWeekDetailResponse
        weeks_detail = []
        for week_num in range(1, (plan.total_units or 0) + 1):
            effective_week_data = use_case.get_effective_week(plan_id, week_num)
            if effective_week_data:
                week = week_repo.get_by_plan_and_week_number(plan_id, week_num)
                days_responses = [
                    build_day_response(day)
                    for day in effective_week_data["days"]
                ]
                weeks_detail.append(
                    PlanWeekDetailResponse(
                        week_number=week_num,
                        mode=week.mode,
                        resolved_week_number=effective_week_data["resolved_week_number"],
                        days=days_responses,
                    )
                )

        return WorkoutPlanDetailResponse(
            plan=WorkoutPlanDetailResponse.Plan(
                id=plan.id,
                user_id=plan.user_id,
                name=plan.name,
                unit_type=plan.unit_type,
                total_units=plan.total_units,
                is_quick_start=plan.is_quick_start,
                created_at=plan.created_at,
                updated_at=plan.updated_at,
            ),
            weeks=weeks_detail,
            days=None,
        )
    else:
        # For days-type plans, return flat day list as before
        days = day_repo.list_by_plan(plan_id)
        days_detail = [build_day_response(day) for day in days]

        return WorkoutPlanDetailResponse(
            plan=WorkoutPlanDetailResponse.Plan(
                id=plan.id,
                user_id=plan.user_id,
                name=plan.name,
                unit_type=plan.unit_type,
                total_units=plan.total_units,
                is_quick_start=plan.is_quick_start,
                created_at=plan.created_at,
                updated_at=plan.updated_at,
            ),
            days=days_detail,
            weeks=None,
        )


@workouts_router.put("/{plan_id}", response_model=WorkoutPlanResponse)
async def update_workout_plan(
    plan_id: int,
    req: UpdateWorkoutPlanRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    use_case = UpdateWorkoutPlan(plan_repo)
    updated = use_case.execute(plan_id, req.name, user_id)
    return updated


@workouts_router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_plan(
    plan_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    use_case = DeleteWorkoutPlan(plan_repo)
    use_case.execute(plan_id, user_id)


# ===== Day Management Endpoints =====

@workouts_router.post("/{plan_id}/days", response_model=PlanDayResponse, status_code=status.HTTP_201_CREATED)
async def create_day(
    plan_id: int,
    req: CreateDayRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    use_case = CreateDay(plan_repo, day_repo)
    day = use_case.execute(plan_id, user_id, req.label)

    return PlanDayResponse(
        id=day.id,
        label=day.label,
        order_position=day.order_position,
        is_rest=day.is_rest,
        created_at=day.created_at,
        updated_at=day.updated_at,
    )


@workouts_router.get("/{plan_id}/days", response_model=list[PlanDayResponse])
async def list_days_for_plan(
    plan_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    use_case = ListDaysForPlan(plan_repo, day_repo)
    days_data = use_case.execute(plan_id, user_id)

    return [
        PlanDayResponse(
            id=d["id"],
            label=d["label"],
            order_position=d["order_position"],
            is_rest=d.get("is_rest", False),
            created_at=d["created_at"],
            updated_at=d["updated_at"],
        )
        for d in days_data
    ]


@workouts_router.put("/{plan_id}/days/{day_id}", response_model=PlanDayResponse)
async def update_day(
    plan_id: int,
    day_id: int,
    req: UpdateDayRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    use_case = UpdateDay(plan_repo, day_repo)
    day_data = use_case.execute(plan_id, day_id, user_id, req.label, req.is_rest)

    return PlanDayResponse(
        id=day_data["id"],
        label=day_data["label"],
        order_position=day_data["order_position"],
        is_rest=day_data.get("is_rest", False),
        created_at=day_data["created_at"],
        updated_at=day_data["updated_at"],
    )


@workouts_router.delete("/{plan_id}/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day(
    plan_id: int,
    day_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    session_repo = WorkoutSessionRepositoryImpl(db)
    use_case = DeleteDay(plan_repo, day_repo, session_repo)
    use_case.execute(plan_id, day_id, user_id)


@workouts_router.get("/{plan_id}/days/{day_id}/previous-performance", response_model=PreviousPerformanceResponse)
async def get_previous_performance(
    plan_id: int,
    day_id: int,
    exclude_session_id: int | None = None,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the most recent finished workout session for a plan day.

    Returns the session date and all logged sets grouped by exercise.
    If no previous session exists, returns empty exercises list with session_date=null.

    Args:
        plan_id: The workout plan id.
        day_id: The plan day id.
        exclude_session_id: Optional session id to exclude (e.g., current in-progress session).
        user_id: The authenticated user id.
        db: Database session.

    Returns:
        PreviousPerformanceResponse with session_date and exercises.
    """
    # Ownership check: verify plan exists and is owned by user
    plan_repo = WorkoutPlanRepositoryImpl(db)
    plan = plan_repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout plan not found")
    if plan.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    # Verify day belongs to plan
    day_repo = PlanDayRepositoryImpl(db)
    day = day_repo.get_by_id(day_id)
    if not day:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found")
    if day.workout_plan_id != plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found")

    # Get previous performance
    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    use_case = GetPreviousPerformance(session_repo, set_repo)
    session_date, sets_by_exercise = use_case.execute(day_id, exclude_session_id)

    # Build response
    exercises_response = []
    for workout_exercise_id in sorted(sets_by_exercise.keys()):
        sets = sets_by_exercise[workout_exercise_id]
        sets_response = [
            PreviousPerformanceSetResponse(
                set_number=s.set_number,
                weight=s.weight,
                reps=s.reps,
                duration_seconds=s.duration_seconds,
            )
            for s in sets
        ]
        exercises_response.append(
            PreviousPerformanceExerciseResponse(
                workout_exercise_id=workout_exercise_id,
                sets=sets_response,
            )
        )

    return PreviousPerformanceResponse(
        session_date=session_date,
        exercises=exercises_response,
    )


# ===== Exercise Management Endpoints (scoped to days) =====

@workouts_router.post("/{plan_id}/days/{day_id}/exercises", response_model=WorkoutExerciseResponse, status_code=status.HTTP_201_CREATED)
async def add_exercise_to_day(
    plan_id: int,
    day_id: int,
    req: AddExerciseRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    exercise_domain_repo = ExerciseRepositoryImpl(db)
    use_case = AddExerciseToDay(plan_repo, day_repo, exercise_repo, exercise_domain_repo)
    workout_exercise = use_case.execute(
        plan_id,
        day_id,
        req.exercise_id,
        user_id,
        target_sets=req.target_sets,
        target_reps=req.target_reps,
        target_weight=req.target_weight,
        target_duration_seconds=req.target_duration_seconds,
        has_reps=req.has_reps,
        has_weight=req.has_weight,
        has_duration=req.has_duration,
    )
    return _build_workout_exercise_response(workout_exercise, db, include_exercise_name=False)


@workouts_router.delete("/{plan_id}/days/{day_id}/exercises/{workout_exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_exercise_from_day(
    plan_id: int,
    day_id: int,
    workout_exercise_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    use_case = RemoveExerciseFromDay(plan_repo, day_repo, exercise_repo)
    use_case.execute(plan_id, day_id, workout_exercise_id, user_id)


@workouts_router.put("/{plan_id}/days/{day_id}/exercises/{workout_exercise_id}/move", response_model=WorkoutExerciseResponse)
async def reorder_day_exercise(
    plan_id: int,
    day_id: int,
    workout_exercise_id: int,
    req: ReorderExerciseRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    use_case = ReorderDayExercise(plan_repo, day_repo, exercise_repo)
    updated = use_case.execute(plan_id, day_id, workout_exercise_id, user_id, req.direction)

    return _build_workout_exercise_response(updated, db, include_exercise_name=False)


@workouts_router.put("/{plan_id}/days/{day_id}/exercises/{workout_exercise_id}", response_model=WorkoutExerciseResponse)
async def update_exercise_in_day(
    plan_id: int,
    day_id: int,
    workout_exercise_id: int,
    req: UpdateExerciseInDayRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Update an exercise's targets and notes in place.

    This allows editing target_sets, target_reps, target_weight, target_duration_seconds,
    has_reps, has_weight, has_duration, and notes without removing and re-adding the exercise.
    exercise_id and order_number are immutable.

    Request body (all fields optional):
    {
      "target_sets": 4,
      "target_reps": "6",
      "target_weight": 185.5,
      "target_duration_seconds": 60,
      "has_reps": true,
      "has_weight": true,
      "has_duration": false,
      "notes": "pause at bottom"
    }

    Returns the updated exercise.
    """
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    use_case = UpdateExerciseInDay(plan_repo, day_repo, exercise_repo)
    exercise_data = use_case.execute(
        plan_id,
        day_id,
        workout_exercise_id,
        user_id,
        target_sets=req.target_sets,
        target_reps=req.target_reps,
        target_weight=req.target_weight,
        target_duration_seconds=req.target_duration_seconds,
        notes=req.notes,
        has_reps=req.has_reps,
        has_weight=req.has_weight,
        has_duration=req.has_duration,
    )

    # Fetch the updated exercise and return full response with set_targets
    updated_exercise = exercise_repo.get_by_id(exercise_data["id"])
    return _build_workout_exercise_response(updated_exercise, db, include_exercise_name=False)


@workouts_router.put("/{plan_id}/days/{day_id}/exercises/{workout_exercise_id}/set-targets", response_model=WorkoutExerciseDetailedResponse)
async def update_exercise_set_targets(
    plan_id: int,
    day_id: int,
    workout_exercise_id: int,
    set_targets_list: list[SetTargetRequest],
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Replace all per-set targets for a workout exercise.

    Atomically deletes all existing set targets for the exercise and replaces them
    with the provided list. This is the primary way to edit the "Vary by set" table.

    Request body: array of set target specs
    [
      {"set_number": 1, "target_reps": "8", "target_weight": 135.0},
      {"set_number": 2, "target_reps": "6", "target_weight": 155.0}
    ]

    Empty array is allowed (clears all set targets).

    Returns the updated exercise with its new set_targets list.
    """
    from src.modules.workouts.domain.entities.workout_exercise_set_target import WorkoutExerciseSetTarget

    # Verify plan ownership and existence
    plan_repo = WorkoutPlanRepositoryImpl(db)
    plan = plan_repo.get_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout plan not found")
    if plan.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    # Verify day exists and belongs to plan
    day_repo = PlanDayRepositoryImpl(db)
    day = day_repo.get_by_id(day_id)
    if not day:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found")
    if day.workout_plan_id != plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan day not found")

    # Verify exercise exists and belongs to day
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    exercise = exercise_repo.get_by_id(workout_exercise_id)
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    if exercise.plan_day_id != day_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found in day")

    # Convert request items to domain entities
    set_targets = [
        WorkoutExerciseSetTarget(
            workout_exercise_id=workout_exercise_id,
            set_number=st.set_number,
            target_reps=st.target_reps,
            target_weight=st.target_weight,
            target_duration_seconds=st.target_duration_seconds,
        )
        for st in set_targets_list
    ]

    # Atomically replace all set targets for this exercise
    set_target_repo = WorkoutExerciseSetTargetRepositoryImpl(db)
    set_target_repo.replace_all_for_exercise(workout_exercise_id, set_targets)

    # Fetch the updated exercise and return with new set_targets
    return _build_workout_exercise_response(exercise, db, include_exercise_name=True)


# ===== Week Management Endpoints (for weeks-type plans) =====

@workouts_router.post("/{plan_id}/weeks/{week_number}/customize", status_code=status.HTTP_204_NO_CONTENT)
async def customize_week(
    plan_id: int,
    week_number: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Customize a week by deep-copying its effective days.

    This resolves the week's current effective content (walking backward through
    the link chain if needed), deep-copies those days and exercises into new rows
    parented to this week, and flips the week's mode to 'custom'.

    Args:
        plan_id: The workout plan id.
        week_number: The week number (1-indexed).
        user_id: The authenticated user id.
        db: Database session.
    """
    plan_repo = WorkoutPlanRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    exercise_repo = WorkoutExerciseRepositoryImpl(db)
    use_case = CustomizeWeek(plan_repo, week_repo, day_repo, exercise_repo)
    use_case.execute(plan_id, week_number, user_id)


@workouts_router.post("/{plan_id}/weeks/{week_number}/match-previous", status_code=status.HTTP_204_NO_CONTENT)
async def match_previous_week(
    plan_id: int,
    week_number: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Revert a custom week to linked by deleting its days.

    Only succeeds if none of the week's days have logged sessions.
    If any sessions exist, raises WeekHasSessionsError (409).

    Args:
        plan_id: The workout plan id.
        week_number: The week number (1-indexed).
        user_id: The authenticated user id.
        db: Database session.
    """
    plan_repo = WorkoutPlanRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    session_repo = WorkoutSessionRepositoryImpl(db)
    use_case = MatchPreviousWeek(plan_repo, week_repo, day_repo, session_repo)
    use_case.execute(plan_id, week_number, user_id)
