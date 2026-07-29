from datetime import datetime

from ...domain.entities.workout_session import WorkoutSession
from ...domain.exceptions import (
    UnresolvedSessionExistsError,
    WorkoutSessionNotFoundError,
)
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.exceptions import (
    WorkoutPlanNotFoundError,
    UnauthorizedWorkoutPlanAccessError,
    PlanDayNotFoundError,
)
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from src.modules.workouts.domain.interfaces.plan_week_repository import PlanWeekRepository
from src.modules.workouts.domain.interfaces.plan_day_repository import PlanDayRepository
from src.modules.workouts.domain.services.week_resolver import resolve_effective_week


class StartWorkout:
    """Use case: start a new workout session from a plan day."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        session_repository: WorkoutSessionRepository,
        week_repository: PlanWeekRepository | None = None,
        day_repository: PlanDayRepository | None = None,
    ):
        self.plan_repository = plan_repository
        self.session_repository = session_repository
        self.week_repository = week_repository
        self.day_repository = day_repository

    def execute(
        self,
        user_id: int,
        workout_plan_id: int,
        plan_day_id: int | None = None,
        week_number: int | None = None,
    ) -> WorkoutSession:
        """Start a new workout session.

        Args:
            user_id: The user starting the workout.
            workout_plan_id: The plan the session is based on.
            plan_day_id: The specific day within the plan to run (optional for backwards compatibility).
            week_number: For weeks-type plans: the week number the user selected (1-indexed, e.g. 1, 2, 3...).
                         Server will resolve this to the actual backing week, validate that plan_day_id belongs to it,
                         and store the resolved PlanWeek's actual database .id into the session's plan_week_id.

        Returns:
            The created WorkoutSession with plan_week_id set to the PlanWeek.id (if provided).

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan.
            PlanDayNotFoundError: If week_number is provided but doesn't exist,
                                  or if plan_day_id doesn't belong to the resolved week.
        """
        # Validate plan exists and is owned by user
        plan = self.plan_repository.get_by_id(workout_plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {workout_plan_id} not found")

        if plan.user_id != user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {user_id} does not own plan {workout_plan_id}"
            )

        # Check if user has an unresolved session already
        unresolved = self.session_repository.find_unresolved_by_user(user_id)
        if unresolved:
            raise UnresolvedSessionExistsError(
                "You have an unfinished workout — resolve it before starting a new one."
            )

        # If week_number is provided, resolve and validate
        resolved_plan_day_id = plan_day_id
        resolved_plan_week_id = None  # The actual PlanWeek.id to store in the session

        if week_number is not None:
            if not self.week_repository or not self.day_repository:
                raise ValueError("Week repositories required for week-based resolution")

            try:
                # Fetch all weeks and days for this plan
                weeks = self.week_repository.list_by_plan(workout_plan_id)
                all_days = self.day_repository.list_by_plan(workout_plan_id)

                # Build a map of week_id -> [days for that week]
                days_by_week_id = {}
                for day in all_days:
                    if day.plan_week_id not in days_by_week_id:
                        days_by_week_id[day.plan_week_id] = []
                    days_by_week_id[day.plan_week_id].append(day)

                # Resolve the effective week
                resolution = resolve_effective_week(week_number, weeks, days_by_week_id)
                resolved_days = resolution["days"]

                # Verify plan_day_id belongs to the resolved week's days
                if plan_day_id is not None:
                    day_ids_in_resolved_week = {d.id for d in resolved_days}
                    if plan_day_id not in day_ids_in_resolved_week:
                        raise PlanDayNotFoundError(
                            f"Day {plan_day_id} does not belong to the resolved week {resolution['resolved_week_number']}"
                        )
                    resolved_plan_day_id = plan_day_id
                else:
                    # If no day specified but week is specified, this is an error
                    raise ValueError("plan_day_id is required when week_number is provided")

                # Look up the actual PlanWeek row for the originally-requested week_number
                # (not the resolved one, but the one the user asked for)
                requested_week = None
                for w in weeks:
                    if w.week_number == week_number:
                        requested_week = w
                        break

                if not requested_week:
                    raise ValueError(f"Week number {week_number} not found in plan")

                # Store the actual PlanWeek.id (database row id) into the session
                resolved_plan_week_id = requested_week.id

            except ValueError as e:
                # Re-raise ValueError as PlanDayNotFoundError for consistency
                raise PlanDayNotFoundError(str(e))

        # Create the session
        session = WorkoutSession(
            user_id=user_id,
            workout_plan_id=workout_plan_id,
            plan_day_id=resolved_plan_day_id,
            plan_week_id=resolved_plan_week_id,  # Store the actual PlanWeek.id (database foreign key)
            started_at=datetime.utcnow(),
            completed_at=None,
        )
        return self.session_repository.create(session)
