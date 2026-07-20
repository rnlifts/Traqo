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
from ..application.use_cases.delete_workout_set import DeleteWorkoutSet
from ..application.use_cases.finish_workout import FinishWorkout
from ..application.use_cases.get_exercise_progress import GetExerciseProgress
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
from src.modules.workouts.infrastructure.repositories.plan_week_repository_impl import (
    PlanWeekRepositoryImpl,
)
from .schemas import (
    AddWorkoutSetRequest,
    FinishWorkoutResponse,
    StartWorkoutRequest,
    StartWorkoutResponse,
    WorkoutHistoryEntryResponse,
    WorkoutSessionDetailResponse,
    WorkoutSetResponse,
    WorkoutSetWithExerciseResponse,
)

sessions_router = APIRouter(prefix="/api/workout-sessions", tags=["sessions"])


@sessions_router.post("", response_model=StartWorkoutResponse, status_code=status.HTTP_201_CREATED)
async def start_workout(
    req: StartWorkoutRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Start a new workout session.

    For weeks-type plans with week_number: resolves the actual backing week,
    validates plan_day_id belongs to it, and stores the PlanWeek.id (server-side, defense in depth).
    """
    plan_repo = WorkoutPlanRepositoryImpl(db)
    session_repo = WorkoutSessionRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    use_case = StartWorkout(plan_repo, session_repo, week_repo, day_repo)
    session = use_case.execute(
        user_id,
        req.workout_plan_id,
        req.plan_day_id,
        req.week_number,
    )
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
    plan_repo = WorkoutPlanRepositoryImpl(db)
    day_repo = PlanDayRepositoryImpl(db)
    week_repo = PlanWeekRepositoryImpl(db)
    exercise_repo = ExerciseRepositoryImpl(db)
    use_case = GetWorkoutSessionDetail(
        session_repo, set_repo, plan_repo, day_repo, week_repo, exercise_repo
    )
    session, set_details, plan_name, day_label, week_number, duration_minutes = use_case.execute(
        user_id, session_id
    )
    return WorkoutSessionDetailResponse(
        session=WorkoutSessionDetailResponse.Session(
            id=session.id,
            user_id=session.user_id,
            workout_plan_id=session.workout_plan_id,
            plan_name=plan_name,
            plan_day_id=session.plan_day_id,
            day_label=day_label,
            plan_week_id=session.plan_week_id,
            week_number=week_number,
            started_at=session.started_at,
            completed_at=session.completed_at,
            duration_minutes=duration_minutes,
        ),
        sets=[
            WorkoutSetWithExerciseResponse(
                id=sd.workout_set.id,
                exercise_id=sd.workout_set.exercise_id,
                exercise_name=sd.exercise_name,
                set_number=sd.workout_set.set_number,
                weight=sd.workout_set.weight,
                reps=sd.workout_set.reps,
                notes=sd.workout_set.notes,
            )
            for sd in set_details
        ],
    )


@sessions_router.post("/{session_id}/sets", response_model=WorkoutSetResponse, status_code=status.HTTP_201_CREATED)
async def add_workout_set(
    session_id: int,
    req: AddWorkoutSetRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Log or update a set for an exercise in the current workout (upsert).

    If a set at (exercise_id, set_number) already exists, updates it in place.
    Otherwise, creates a new set.
    """
    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    exercise_repo = ExerciseRepositoryImpl(db)
    use_case = AddWorkoutSet(session_repo, set_repo, exercise_repo)
    workout_set = use_case.execute(
        user_id,
        session_id,
        req.exercise_id,
        req.set_number,
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


@sessions_router.delete("/{session_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_set(
    session_id: int,
    set_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a logged set from the current workout."""
    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    use_case = DeleteWorkoutSet(session_repo, set_repo)
    use_case.execute(user_id, session_id, set_id)
    return None


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
            session_id=entry.session_id,
        )
        for entry in entries
    ]


async def get_exercise_progress_handler(
    exercise_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Handler for retrieving per-exercise progress with history, volume, 1RM, and PRs."""
    from .schemas import (
        ExerciseProgressResponse,
        ProgressSessionEntryResponse,
        ProgressSetResponse,
        PersonalRecordsResponse,
    )

    session_repo = WorkoutSessionRepositoryImpl(db)
    set_repo = WorkoutSetRepositoryImpl(db)
    exercise_repo = ExerciseRepositoryImpl(db)
    use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
    result = use_case.execute(user_id, exercise_id)

    return ExerciseProgressResponse(
        exercise_id=result.exercise_id,
        exercise_name=result.exercise_name,
        sessions=[
            ProgressSessionEntryResponse(
                session_id=entry.session_id,
                date=entry.date,
                sets=[
                    ProgressSetResponse(
                        set_number=s.set_number,
                        weight=s.weight,
                        reps=s.reps,
                        notes=s.notes,
                        estimated_1rm=s.estimated_1rm,
                        is_weight_pr=s.is_weight_pr,
                        is_reps_pr=s.is_reps_pr,
                        is_e1rm_pr=s.is_e1rm_pr,
                    )
                    for s in entry.sets
                ],
                volume=entry.volume,
                is_volume_pr=entry.is_volume_pr,
            )
            for entry in result.sessions
        ],
        personal_records=PersonalRecordsResponse(
            heaviest_weight=result.personal_records.heaviest_weight,
            heaviest_weight_date=result.personal_records.heaviest_weight_date,
            best_estimated_1rm=result.personal_records.best_estimated_1rm,
            best_estimated_1rm_date=result.personal_records.best_estimated_1rm_date,
            best_volume=result.personal_records.best_volume,
            best_volume_date=result.personal_records.best_volume_date,
            most_reps=result.personal_records.most_reps,
            most_reps_date=result.personal_records.most_reps_date,
        ),
    )
