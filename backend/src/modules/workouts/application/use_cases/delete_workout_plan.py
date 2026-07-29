from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class DeleteWorkoutPlan:
    """Use case: delete a workout plan (ownership-checked, cascades to sessions/days/exercises)."""

    def __init__(self, plan_repository: WorkoutPlanRepository):
        self.plan_repository = plan_repository

    def execute(self, plan_id: int, requesting_user_id: int) -> None:
        """Delete a workout plan and cascade to all dependent data.

        Raises:
            WorkoutPlanNotFoundError: If plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If user doesn't own plan.
        """
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        self.plan_repository.delete(plan_id)
