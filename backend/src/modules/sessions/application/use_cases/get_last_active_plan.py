"""Use case: get the plan the user most recently worked out on."""

from dataclasses import dataclass

from ...domain.entities.workout_session import WorkoutSession
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.interfaces.plan_day_repository import PlanDayRepository
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository


@dataclass
class EnrichedLastActivePlan:
    """Most recently touched plan, with resolved plan name and day label."""

    session: WorkoutSession
    plan_name: str
    day_label: str | None


class GetLastActivePlan:
    """Use case: find the most recently touched plan for a user's dashboard hero card.

    Used only when there's no unresolved (in-progress) session — see GetUnresolvedSession
    for that case, which always takes priority on the dashboard.
    """

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
    ):
        self.session_repository = session_repository
        self.plan_repository = plan_repository
        self.day_repository = day_repository

    def execute(self, user_id: int) -> EnrichedLastActivePlan | None:
        """
        Get the user's most recently finished session on a plan that still exists.

        Any plan type qualifies, including quick-start plans — whichever plan the user
        most recently touched is "the one they're doing," with no distinction made.
        Sessions whose plan has since been deleted are skipped entirely (there is
        nothing useful to "continue" for a deleted plan) rather than surfaced with a
        placeholder name — this card only ever points at something clickable.

        Args:
            user_id: The user to search for finished sessions.

        Returns:
            Enriched most recent session on a still-existing plan, or None if the user
            has never finished a session on a plan that still exists.
        """
        finished_sessions = self.session_repository.list_finished_by_user(user_id)

        for session in finished_sessions:
            plan = self.plan_repository.get_by_id(session.workout_plan_id)
            if plan is None:
                continue

            day_label = None
            if session.plan_day_id:
                day = self.day_repository.get_by_id(session.plan_day_id)
                day_label = day.label if day else "Deleted Day"

            return EnrichedLastActivePlan(
                session=session,
                plan_name=plan.name,
                day_label=day_label,
            )

        return None
