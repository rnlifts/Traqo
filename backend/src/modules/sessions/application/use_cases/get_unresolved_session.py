"""Use case: get a user's unresolved session with enriched metadata."""

from dataclasses import dataclass

from ...domain.entities.workout_session import WorkoutSession
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.interfaces.plan_day_repository import PlanDayRepository
from src.modules.workouts.domain.interfaces.plan_week_repository import PlanWeekRepository
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository


@dataclass
class EnrichedUnresolvedSession:
    """Unresolved session with resolved plan name and day label."""

    session: WorkoutSession
    plan_name: str
    day_label: str | None
    week_number: int | None


class GetUnresolvedSession:
    """Use case: retrieve a user's unresolved session if any exists."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        week_repository: PlanWeekRepository,
    ):
        self.session_repository = session_repository
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.week_repository = week_repository

    def execute(self, user_id: int) -> EnrichedUnresolvedSession | None:
        """
        Get the user's most recent unresolved session with enriched metadata.

        Args:
            user_id: The user to search for unresolved sessions.

        Returns:
            Enriched session (with plan_name/day_label/week_number), or None if no unresolved session exists.
        """
        session = self.session_repository.find_unresolved_by_user(user_id)
        if not session:
            return None

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

        return EnrichedUnresolvedSession(
            session=session,
            plan_name=plan_name,
            day_label=day_label,
            week_number=week_number,
        )
