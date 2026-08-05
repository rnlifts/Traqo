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
        skip_ownership_check: bool = False,
    ) -> PlanDay:
        """Create a new day in a plan.

        Args:
            plan_id: The workout plan id.
            requesting_user_id: The authenticated user id.
            label: The day label.
            skip_ownership_check: If True, skip the ownership check (used for share-authorized paths).
                Defaults to False to preserve existing behavior.

        Returns:
            PlanDay: The created day.

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan (and not skip_ownership_check).
            ValueError: If the label is empty.
        """
        # Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if not skip_ownership_check and plan.user_id != requesting_user_id:
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
