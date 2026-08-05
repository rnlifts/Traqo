from datetime import datetime

from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.exceptions import UnauthorizedWorkoutPlanAccessError, WorkoutPlanNotFoundError
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class UpdateWorkoutPlan:
    """Use case: update a workout plan (ownership-checked)."""

    def __init__(self, plan_repository: WorkoutPlanRepository):
        self.plan_repository = plan_repository

    def execute(self, plan_id: int, new_name: str, requesting_user_id: int, skip_ownership_check: bool = False) -> WorkoutPlan:
        """Update a workout plan's name.

        Args:
            plan_id: The workout plan id.
            new_name: The new plan name.
            requesting_user_id: The authenticated user id.
            skip_ownership_check: If True, skip the ownership check (used for share-authorized paths).
                Defaults to False to preserve existing behavior.

        Returns:
            WorkoutPlan: The updated plan.

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan (and not skip_ownership_check).
        """
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if not skip_ownership_check and plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        plan.name = new_name
        plan.updated_at = datetime.utcnow()
        return self.plan_repository.update(plan)
