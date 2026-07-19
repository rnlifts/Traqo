from ...domain.entities.plan_day import PlanDay
from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class ListDaysForPlan:
    """Use case: list all days in a workout plan."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository

    def execute(
        self,
        plan_id: int,
        requesting_user_id: int,
    ) -> list[dict]:
        """List all days in a plan.

        Returns a list of dicts with structure:
        {
            "id": int,
            "label": str,
            "order_position": int,
            "is_rest": bool
        }
        """
        # Verify plan exists and is owned by user
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Get all days for the plan
        days = self.day_repository.list_by_plan(plan_id)

        # Build result with is_rest flag
        result = []
        for day in days:
            result.append({
                "id": day.id,
                "label": day.label,
                "order_position": day.order_position,
                "is_rest": day.is_rest,
                "created_at": day.created_at,
                "updated_at": day.updated_at,
            })

        return result
