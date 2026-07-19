from ...domain.exceptions import (
    PlanDayNotFoundError,
    PlanDayHasSessionsError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.sessions.domain.interfaces.workout_session_repository import (
    WorkoutSessionRepository,
)


class DeleteDay:
    """Use case: delete a plan day (blocked if sessions reference it)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        session_repository: WorkoutSessionRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.session_repository = session_repository

    def execute(self, plan_id: int, day_id: int, requesting_user_id: int) -> None:
        """Delete a plan day.

        Check order:
        1. Verify plan exists and is owned by user
        2. Verify day exists and belongs to this plan
        3. Check if any sessions reference this day
        4. Delete the day
        """
        # Step 1: Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Step 2: Load and validate day
        day = self.day_repository.get_by_id(day_id)
        if not day:
            raise PlanDayNotFoundError(f"Day {day_id} not found")

        if day.workout_plan_id != plan_id:
            raise PlanDayNotFoundError(f"Day {day_id} does not belong to plan {plan_id}")

        # Step 3: Check if any sessions reference this day
        if self.session_repository.exists_for_day(day_id):
            raise PlanDayHasSessionsError(
                f"Cannot delete day {day_id} because it has recorded workout history"
            )

        # Step 4: Delete the day (cascades to weekday assignments and exercises)
        self.day_repository.delete(day_id)
