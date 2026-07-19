from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanHasSessionsError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.sessions.domain.interfaces.workout_session_repository import (
    WorkoutSessionRepository,
)


class DeleteWorkoutPlan:
    """Use case: delete a workout plan (ownership-checked, blocks deletion if sessions exist)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        session_repository: WorkoutSessionRepository,
    ):
        self.plan_repository = plan_repository
        self.session_repository = session_repository

    def execute(self, plan_id: int, requesting_user_id: int) -> None:
        """Delete a workout plan.

        Raises:
            WorkoutPlanNotFoundError: If plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If user doesn't own plan.
            WorkoutPlanHasSessionsError: If plan has any workout sessions.
        """
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        if self.session_repository.exists_for_plan(plan_id):
            raise WorkoutPlanHasSessionsError(
                f"Cannot delete plan {plan_id} because it has recorded workout history"
            )

        self.plan_repository.delete(plan_id)
