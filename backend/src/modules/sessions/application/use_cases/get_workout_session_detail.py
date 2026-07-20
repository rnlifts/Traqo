from dataclasses import dataclass

from ...domain.entities.workout_session import WorkoutSession
from ...domain.entities.workout_set import WorkoutSet
from ...domain.exceptions import (
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository
from src.modules.workouts.domain.interfaces.plan_day_repository import PlanDayRepository
from src.modules.workouts.domain.interfaces.plan_week_repository import PlanWeekRepository
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository


@dataclass
class SetDetail:
    """Set with resolved exercise name."""

    workout_set: WorkoutSet
    exercise_name: str


class GetWorkoutSessionDetail:
    """Use case: retrieve a session and all its logged sets with resolved names."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        week_repository: PlanWeekRepository,
        exercise_repository: ExerciseRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.week_repository = week_repository
        self.exercise_repository = exercise_repository

    def execute(
        self, user_id: int, session_id: int
    ) -> tuple[WorkoutSession, list[SetDetail], str, str | None, int | None, int | None]:
        """Get session details along with all logged sets and resolved metadata.

        Args:
            user_id: The user requesting the detail.
            session_id: The session to retrieve.

        Returns:
            Tuple of (session, list of SetDetail, plan_name, day_label, week_number, duration_minutes).

        Raises:
            WorkoutSessionNotFoundError: If the session doesn't exist.
            UnauthorizedWorkoutSessionAccessError: If user doesn't own the session.
        """
        # Load session
        session = self.session_repository.get_by_id(session_id)
        if not session:
            raise WorkoutSessionNotFoundError(f"Session {session_id} not found")

        # Check ownership
        if session.user_id != user_id:
            raise UnauthorizedWorkoutSessionAccessError(
                f"User {user_id} does not own session {session_id}"
            )

        # Load sets
        sets = self.set_repository.list_by_session(session_id)

        # Resolve plan name
        plan = self.plan_repository.get_by_id(session.workout_plan_id)
        plan_name = plan.name if plan else "Deleted Plan"

        # Resolve day label
        day_label = None
        if session.plan_day_id:
            day = self.day_repository.get_by_id(session.plan_day_id)
            day_label = day.label if day else "Deleted Day"

        # Resolve week number
        week_number = None
        if session.plan_week_id:
            week = self.week_repository.get_by_id(session.plan_week_id)
            week_number = week.week_number if week else None

        # Calculate duration
        duration_minutes = None
        if session.completed_at:
            duration_minutes = int((session.completed_at - session.started_at).total_seconds() // 60)

        # Resolve exercise names (once per distinct exercise_id)
        exercise_names: dict[int, str] = {}
        for s in sets:
            if s.exercise_id not in exercise_names:
                exercise = self.exercise_repository.get_by_id(s.exercise_id)
                exercise_names[s.exercise_id] = exercise.name if exercise else "Deleted Exercise"

        # Build set details with exercise names
        set_details = [
            SetDetail(
                workout_set=s,
                exercise_name=exercise_names[s.exercise_id],
            )
            for s in sets
        ]

        return session, set_details, plan_name, day_label, week_number, duration_minutes
