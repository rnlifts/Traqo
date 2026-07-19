from datetime import datetime

from ...domain.entities.workout_session import WorkoutSession
from ...domain.exceptions import WorkoutSessionNotFoundError
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.exceptions import WorkoutPlanNotFoundError, UnauthorizedWorkoutPlanAccessError
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class StartWorkout:
    """Use case: start a new workout session from a plan day."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        session_repository: WorkoutSessionRepository,
    ):
        self.plan_repository = plan_repository
        self.session_repository = session_repository

    def execute(
        self,
        user_id: int,
        workout_plan_id: int,
        plan_day_id: int | None = None,
    ) -> WorkoutSession:
        """Start a new workout session.

        Args:
            user_id: The user starting the workout.
            workout_plan_id: The plan the session is based on.
            plan_day_id: The specific day within the plan to run (optional for backwards compatibility).

        Returns:
            The created WorkoutSession.

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan.
        """
        # Validate plan exists and is owned by user
        plan = self.plan_repository.get_by_id(workout_plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {workout_plan_id} not found")

        if plan.user_id != user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {user_id} does not own plan {workout_plan_id}"
            )

        # Create the session
        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=workout_plan_id,
            plan_day_id=plan_day_id,
            started_at=datetime.utcnow(),
            completed_at=None,
        )
        return self.session_repository.create(session)
