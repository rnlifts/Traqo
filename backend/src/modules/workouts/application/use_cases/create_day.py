from ...domain.entities.plan_day import PlanDay
from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class CreateDay:
    """Use case: create a new day within a workout plan."""

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
        label: str,
    ) -> PlanDay:
        """Create a new day in a plan."""
        # Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Validate label is non-empty
        if not label or not label.strip():
            raise ValueError("Day label cannot be empty")

        # Determine next order_position
        existing_days = self.day_repository.list_by_plan(plan_id)
        next_order = len(existing_days) + 1

        # Create the day
        plan_day = PlanDay(
            workout_plan_id=plan_id,
            label=label,
            order_position=next_order,
        )
        created_day = self.day_repository.create(plan_day)

        return created_day
