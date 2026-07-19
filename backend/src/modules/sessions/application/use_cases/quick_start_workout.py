from datetime import datetime

from ...domain.entities.workout_session import WorkoutSession
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.entities.plan_day import PlanDay
from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.interfaces.plan_day_repository import (
    PlanDayRepository,
)
from src.modules.workouts.domain.interfaces.workout_plan_repository import (
    WorkoutPlanRepository,
)


class QuickStartWorkout:
    """Use case: quickly start a workout without building a plan first.

    Creates a new plan, day, and session all in one call, allowing the user
    to start logging immediately.
    """

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        session_repository: WorkoutSessionRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository
        self.session_repository = session_repository

    def execute(self, user_id: int) -> WorkoutSession:
        """Create a quick workout plan and session for a user.

        Creates:
        1. A new WorkoutPlan with auto-generated name (e.g., "Quick Workout - Jul 19")
        2. A PlanDay labeled "Day 1" with no weekday assignments
        3. A WorkoutSession for that day

        Args:
            user_id: The user starting the quick workout.

        Returns:
            The created WorkoutSession (ready for exercise logging).
        """
        # Generate plan name with today's date
        today = datetime.utcnow()
        plan_name = f"Quick Workout - {today.strftime('%b %d')}"

        # Step 1: Create and persist the plan
        plan = WorkoutPlan(user_id=user_id, name=plan_name)
        created_plan = self.plan_repository.create(plan)

        # Step 2: Create and persist the day
        plan_day = PlanDay(
            workout_plan_id=created_plan.id,
            label="Day 1",
            order_position=1,
        )
        created_day = self.day_repository.create(plan_day)

        # Step 3: Create and return the session
        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=created_plan.id,
            plan_day_id=created_day.id,
            started_at=datetime.utcnow(),
            completed_at=None,
        )
        return self.session_repository.create(session)
