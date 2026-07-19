from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.exceptions import UnauthorizedWorkoutPlanAccessError, WorkoutPlanNotFoundError
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.plan_week_repository import PlanWeekRepository


class GetWorkoutPlanDetail:
    """Use case: get a plan plus its exercises and resolved week structure (ownership-checked)."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        exercise_repository: WorkoutExerciseRepository,
        day_repository: PlanDayRepository | None = None,
        week_repository: PlanWeekRepository | None = None,
    ):
        self.plan_repository = plan_repository
        self.exercise_repository = exercise_repository
        self.day_repository = day_repository
        self.week_repository = week_repository

    def execute(self, plan_id: int, requesting_user_id: int) -> tuple[WorkoutPlan, list[WorkoutExercise]]:
        """Get a workout plan and its ordered exercises."""
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        exercises = self.exercise_repository.list_by_plan(plan_id)
        return plan, exercises

    def get_effective_week(self, plan_id: int, week_number: int) -> dict | None:
        """
        For weeks-type plans: resolve a week's effective (non-linked) content.

        Walks backward from week_number to the nearest preceding non-linked week
        and returns that week's plan_day rows along with resolution metadata.

        This is the server-side link-resolution algorithm from spec §1.4/§4.4.
        Frontend never needs to re-implement this.

        Returns:
            dict with keys: {
                'resolved_week_number': int (the week whose content is effective),
                'days': list[PlanDay]
            }
            or None if not found.
        """
        if not self.week_repository or not self.day_repository:
            return None

        weeks = self.week_repository.list_by_plan(plan_id)

        # Find the week to start from
        current_week = None
        for w in weeks:
            if w.week_number == week_number:
                current_week = w
                break

        if not current_week:
            return None

        # Walk backward to find the nearest non-linked week
        j = week_number
        target_week = None
        while j >= 1:
            w = None
            for week in weeks:
                if week.week_number == j:
                    w = week
                    break

            if w and w.mode != "linked":
                target_week = w
                break

            j -= 1

        if not target_week:
            return None

        # Get the days for this target week
        all_days = self.day_repository.list_by_plan(plan_id)
        effective_days = [d for d in all_days if d.plan_week_id == target_week.id]

        return {
            "resolved_week_number": target_week.week_number,
            "mode": current_week.mode,
            "days": effective_days,
        }
