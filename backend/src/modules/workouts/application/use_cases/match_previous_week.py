"""Use case: Revert a custom week to linked by deleting its days (if no sessions exist)."""

from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
    PlanDayNotFoundError,
    WeekHasSessionsError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.plan_week_repository import PlanWeekRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.sessions.domain.interfaces.workout_session_repository import WorkoutSessionRepository


class MatchPreviousWeek:
    """Use case: Revert a custom week to linked by deleting its days (if no sessions exist)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        week_repository: PlanWeekRepository,
        day_repository: PlanDayRepository,
        session_repository: WorkoutSessionRepository,
    ):
        self.plan_repository = plan_repository
        self.week_repository = week_repository
        self.day_repository = day_repository
        self.session_repository = session_repository

    def execute(self, plan_id: int, week_number: int, user_id: int) -> None:
        """
        Revert a week from custom to linked.

        Only succeeds if the week has no logged sessions.
        If any of the week's days have session history, raises WeekHasSessionsError with 409.
        """
        # Ownership check
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")
        if plan.user_id != user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {user_id} does not own plan {plan_id}"
            )

        # Get the week
        week = self.week_repository.get_by_plan_and_week_number(plan_id, week_number)
        if not week:
            raise PlanDayNotFoundError(f"Week {week_number} not found in plan {plan_id}")

        # Get this week's own days (only for custom weeks)
        all_days = self.day_repository.list_by_plan(plan_id)
        week_days = [d for d in all_days if d.plan_week_id == week.id]

        # Check if any of these days have session history
        for day in week_days:
            if self.session_repository.exists_for_day(day.id):
                raise WeekHasSessionsError(
                    f"Week {week_number} has logged workouts and can't be reverted to match another week. "
                    f"Customize it again with new content instead."
                )

        # No sessions found, safe to delete the days and flip mode to 'linked'
        for day in week_days:
            self.day_repository.delete(day.id)

        # Flip mode to 'linked'
        week.mode = "linked"
        self.week_repository.update(week)
