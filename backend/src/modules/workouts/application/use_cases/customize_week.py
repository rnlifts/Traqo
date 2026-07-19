"""Use case: Customize a week by deep-copying its effective days and flipping mode to 'custom'."""

from ...domain.entities.plan_day import PlanDay
from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
    PlanDayNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.plan_week_repository import PlanWeekRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository


class CustomizeWeek:
    """Use case: Customize a week by deep-copying its effective days."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        week_repository: PlanWeekRepository,
        day_repository: PlanDayRepository,
        exercise_repository: WorkoutExerciseRepository,
    ):
        self.plan_repository = plan_repository
        self.week_repository = week_repository
        self.day_repository = day_repository
        self.exercise_repository = exercise_repository

    def execute(self, plan_id: int, week_number: int, user_id: int) -> None:
        """
        Customize a week by deep-copying its effective days.

        1. Verify plan ownership
        2. Resolve the week's effective days (via walk-backward algorithm)
        3. Deep-copy those days and their exercises, parenting to this week
        4. Flip the week's mode to 'custom'
        """
        # Ownership check
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")
        if plan.user_id != user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {user_id} does not own plan {plan_id}"
            )

        # Get the week
        week = self.week_repository.get_by_plan_and_week_number(plan_id, week_number)
        if not week:
            raise PlanDayNotFoundError(f"Week {week_number} not found in plan {plan_id}")

        # Resolve the effective days for this week
        effective_days = self._get_effective_week_days(plan_id, week_number)

        # Deep-copy those days and their exercises to this week
        for source_day in effective_days:
            # Create new day parented to this week
            new_day = PlanDay(
                workout_plan_id=plan_id,
                label=source_day.label,
                order_position=source_day.order_position,
                is_rest=source_day.is_rest,
                plan_week_id=week.id,
            )
            created_day = self.day_repository.create(new_day)

            # Copy exercises from source day to new day
            source_exercises = self.exercise_repository.list_by_day(source_day.id)
            for source_ex in source_exercises:
                new_exercise = WorkoutExercise(
                    plan_day_id=created_day.id,
                    exercise_id=source_ex.exercise_id,
                    order_number=source_ex.order_number,
                    target_sets=source_ex.target_sets,
                    target_reps=source_ex.target_reps,
                    target_weight=source_ex.target_weight,
                    notes=source_ex.notes,
                )
                self.exercise_repository.add(new_exercise)

        # Flip mode to 'custom'
        week.mode = "custom"
        self.week_repository.update(week)

    def _get_effective_week_days(self, plan_id: int, week_number: int) -> list[PlanDay]:
        """
        Walk backward from week_number to find the nearest preceding non-linked week,
        and return its plan_day rows.

        This is the exact algorithm from spec §1.4:
        ```
        function getEffectiveDays(weekIdx){
          let j = weekIdx;
          while(draft.weeks[j].mode === 'linked') j--;
          return draft.weeks[j].days;
        }
        ```
        But in 1-indexed terms and persisted rows.
        """
        weeks = self.week_repository.list_by_plan(plan_id)

        # Find the week to start from
        current_week = None
        for w in weeks:
            if w.week_number == week_number:
                current_week = w
                break

        if not current_week:
            raise PlanDayNotFoundError(f"Week {week_number} not found")

        # Walk backward to find the nearest non-linked week
        j = week_number
        target_week = None
        while j >= 1:
            w = None
            for week in weeks:
                if week.week_number == j:
                    w = week
                    break

            if not w:
                j -= 1
                continue

            if w.mode != "linked":
                # Found a non-linked week
                target_week = w
                break

            j -= 1

        if not target_week:
            raise PlanDayNotFoundError(f"No base week found for week {week_number}")

        # Return only the days for this target week
        all_days = self.day_repository.list_by_plan(plan_id)
        return [d for d in all_days if d.plan_week_id == target_week.id]
