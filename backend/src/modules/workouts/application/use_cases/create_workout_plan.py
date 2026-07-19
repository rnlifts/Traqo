from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class CreateWorkoutPlan:
    """Use case: create a new workout plan for a user."""

    def __init__(self, plan_repository: WorkoutPlanRepository):
        self.plan_repository = plan_repository

    def execute(self, user_id: int, name: str) -> WorkoutPlan:
        """Create a new workout plan."""
        plan = WorkoutPlan(user_id=user_id, name=name)
        return self.plan_repository.create(plan)
