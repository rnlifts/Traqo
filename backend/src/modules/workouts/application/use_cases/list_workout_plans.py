from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class ListWorkoutPlans:
    """Use case: list all workout plans for a user."""

    def __init__(self, plan_repository: WorkoutPlanRepository):
        self.plan_repository = plan_repository

    def execute(self, user_id: int) -> list[WorkoutPlan]:
        """List all workout plans for a user."""
        return self.plan_repository.list_by_user(user_id)
