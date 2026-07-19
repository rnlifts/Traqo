from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id
from src.modules.exercises.infrastructure.repositories.exercise_repository_impl import (
    ExerciseRepositoryImpl,
)
from src.modules.workouts.infrastructure.repositories.workout_plan_repository_impl import (
    WorkoutPlanRepositoryImpl,
)
from ..application.use_cases.add_workout_set import AddWorkoutSet
from ..application.use_cases.finish_workout import FinishWorkout
from ..application.use_cases.get_workout_history import GetWorkoutHistory
from ..application.use_cases.get_workout_session_detail import GetWorkoutSessionDetail
from ..application.use_cases.quick_start_workout import QuickStartWorkout
from ..application.use_cases.start_workout import StartWorkout
from ..infrastructure.repositories.workout_session_repository_impl import (
    WorkoutSessionRepositoryImpl,
)
from ..infrastructure.repositories.workout_set_repository_impl import WorkoutSetRepositoryImpl
from src.modules.workouts.infrastructure.repositories.plan_day_repository_impl import (
    PlanDayRepositoryImpl,
)
from .schemas import (
    AddWorkoutSetRequest,
    FinishWorkoutResponse,
    StartWorkoutRequest,
    StartWorkoutResponse,
    WorkoutHistoryEntryResponse,
    WorkoutSessionDetailResponse,
    WorkoutSetResponse,
)

sessions_router = APIRouter(prefix="/api/workout-sessions", tags=["sessions"])


@sessions_router.post("", response_model=StartWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def start_workout(
    req: StartWorkoutRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Start a new workout session."""
    plan_repo = WorkoutPlanRepositoryImpl(db)
    session_repo = WorkoutSessionRepositoryImpl(db)
    use_case = StartWorkout(plan_repo, session_repo)
    session = use_case.execute(user_id, req.workout_plan_id, req.plan_day_id)
    return StartWorkoutResponse(
        session_id=session.id,
        message="Workout started",
    )


@sessions_router.post("/quick-start", response_model=StartWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def quick_start_workout(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Quickly start a new workout without a pre-built plan.

    Creates a new plan, day, and session all in one call. The user can
    immediately start logging exercises without having to plan first.
    """
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    session_repo = WorkoutSessionRepositoryImpl(db)
    use_case = QuickStartWorkout(plan_repo, day_repo, session_repo)
    session = use_case.execute(user_id)
    return StartWorkoutResponse(
        session_id=session.id,
        message="Quick workout started",
    )


@sessions_router.get("/{session_id}", response_model=WorkoutSessionDetailResponse)
async def get_workout_session_detail(
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get session details with all logged sets."""
    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    use_case = GetWorkoutSessionDetail(session_repo, set_repo)
    session, sets = use_case.execute(user_id, session_id)
    return WorkoutSessionDetailResponse(
        session=WorkoutSessionDetailResponse.Session(
            id=session.id,
            user_id=session.user_id,
            workout_plan_id=session.workout_plan_id,
            plan_day_id=session.plan_day_id,
            started_at=session.started_at,
            completed_at=session.completed_at,
        ),
        sets=[
            WorkoutSetResponse(
                id=s.id,
                workout_session_id=s.workout_session_id,
                exercise_id=s.exercise_id,
                set_number=s.set_number,
                weight=s.weight,
                reps=s.reps,
                notes=s.notes,
            )
            for s in sets
        ],
    )


@sessions_router.post("/{session_id}/sets", response_model=WorkoutSetResponse, status_code=status.HTTP_201_CREATED)
async def add_workout_set(
    session_id: int,
    req: AddWorkoutSetRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Log a set for an exercise in the current workout."""
    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    exercise_repo = ExerciseRepositoryImpl(db)
    use_case = AddWorkoutSet(session_repo, set_repo, exercise_repo)
    workout_set = use_case.execute(
        user_id,
        session_id,
        req.exercise_id,
        req.weight,
        req.reps,
        req.notes,
    )
    return WorkoutSetResponse(
        id=workout_set.id,
        workout_session_id=workout_set.workout_session_id,
        exercise_id=workout_set.exercise_id,
        set_number=workout_set.set_number,
        weight=workout_set.weight,
        reps=workout_set.reps,
        notes=workout_set.notes,
    )


@sessions_router.put("/{session_id}/finish", response_model=FinishWorkoutResponse)
async def finish_workout(
    session_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark a workout session as completed."""
    session_repo = WorkoutSessionRepositoryImpl(db)
    use_case = FinishWorkout(session_repo)
    use_case.execute(user_id, session_id)
    return FinishWorkoutResponse(message="Workout completed")


async def get_workout_history_handler(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Handler for retrieving the user's workout history (finished sessions only)."""
    session_repo = WorkoutSessionRepositoryImpl(db)
    plan_repo = WorkoutPlanRepositoryImpl(db)
    use_case = GetWorkoutHistory(session_repo, plan_repo)
    entries = use_case.execute(user_id)
    return [
        WorkoutHistoryEntryResponse(
            date=entry.date,
            workout=entry.workout_name,
            duration=f"{entry.duration_minutes} minutes",
        )
        for entry in entries
    ]
