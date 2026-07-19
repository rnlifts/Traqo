from datetime import datetime

from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.exceptions import UnauthorizedWorkoutPlanAccessError, WorkoutPlanNotFoundError
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class UpdateWorkoutPlan:
    """Use case: update a workout plan (ownership-checked)."""

    def __init__(self, plan_repository: WorkoutPlanRepository):
        self.plan_repository = plan_repository

    def execute(self, plan_id: int, new_name: str, requesting_user_id: int) -> WorkoutPlan:
        """Update a workout plan's name."""
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        plan.name = new_name
        plan.updated_at = datetime.utcnow()
        return self.plan_repository.update(plan)
