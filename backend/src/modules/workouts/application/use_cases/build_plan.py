"""Use case: bulk create a complete workout plan with all structure in a single transaction."""

from typing import Literal
from sqlalchemy.orm import Session

from ...domain.entities.workout_plan import WorkoutPlan
from ...domain.entities.plan_day import PlanDay
from ...domain.entities.plan_week import PlanWeek
from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.exceptions import (
    ExerciseNotOwnedError,
    InvalidPlanStructureError,
    InvalidWeekModeError,
    TotalUnitsMismatchError,
    LinkedWeekWithDaysError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.plan_week_repository import PlanWeekRepository
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository
from ...infrastructure.models.workout_plan_model import WorkoutPlanModel
from ...infrastructure.models.plan_day_model import PlanDayModel
from ...infrastructure.models.plan_week_model import PlanWeekModel
from ...infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from ...infrastructure.models.workout_exercise_set_target_model import WorkoutExerciseSetTargetModel


class BuildPlanDaySpec:
    """Specification for a day to be built."""

    def __init__(
        self,
        label: str,
        is_rest: bool,
        order_position: int,
        exercises: list[dict] | None = None,
    ):
        self.label = label
        self.is_rest = is_rest
        self.order_position = order_position
        self.exercises = exercises or []


class BuildPlanWeekSpec:
    """Specification for a week to be built (weeks-type plans only)."""

    def __init__(
        self,
        week_number: int,
        mode: Literal["base", "linked", "custom"],
        days: list[BuildPlanDaySpec] | None = None,
    ):
        self.week_number = week_number
        self.mode = mode
        self.days = days or []


class BuildPlan:
    """
    Use case: create a complete workout plan with all structure atomically.

    This is a bulk-create operation that builds a plan, weeks/days, and exercises
    in a single transaction. If any validation fails, nothing is persisted.

    Validation:
    - All exercise_ids must belong to the requesting user
    - For weeks plans: week 1 must have mode='base', only one week can have mode='base'
    - Linked weeks must not include days
    - total_units must match the count of provided days/weeks
    """

    def __init__(
        self,
        db: Session,
        exercise_repository_domain: ExerciseRepository,
    ):
        self.db = db
        self.exercise_repository_domain = exercise_repository_domain

    def execute(
        self,
        user_id: int,
        name: str,
        unit_type: Literal["days", "weeks"],
        total_units: int,
        days_spec: list[BuildPlanDaySpec] | None = None,
        weeks_spec: list[BuildPlanWeekSpec] | None = None,
    ) -> WorkoutPlan:
        """
        Build a complete plan atomically.

        Args:
            user_id: The user creating the plan
            name: Plan name
            unit_type: 'days' or 'weeks'
            total_units: Expected count of days or weeks
            days_spec: Day specifications (for unit_type='days')
            weeks_spec: Week specifications (for unit_type='weeks')

        Returns:
            The created WorkoutPlan (domain entity)

        Raises:
            InvalidPlanStructureError: If structure doesn't match unit_type
            InvalidWeekModeError: If week modes are invalid
            TotalUnitsMismatchError: If total_units doesn't match provided count
            LinkedWeekWithDaysError: If a linked week includes days
            ExerciseNotOwnedError: If any exercise isn't owned by user
        """
        try:
            if unit_type == "days":
                return self._build_days_plan(user_id, name, total_units, days_spec or [])
            elif unit_type == "weeks":
                return self._build_weeks_plan(user_id, name, total_units, weeks_spec or [])
            else:
                raise InvalidPlanStructureError(f"Invalid unit_type: {unit_type}")
        except Exception as e:
            # Rollback on any error
            self.db.rollback()
            raise

    def _build_days_plan(
        self,
        user_id: int,
        name: str,
        total_units: int,
        days_spec: list[BuildPlanDaySpec],
    ) -> WorkoutPlan:
        """Build a days-type plan."""
        # Validate total_units matches
        if len(days_spec) != total_units:
            raise TotalUnitsMismatchError(
                f"Expected {total_units} days but got {len(days_spec)}"
            )

        # Validate all exercises are owned by user
        for day_spec in days_spec:
            for exercise_spec in day_spec.exercises:
                exercise = self.exercise_repository_domain.get_by_id(
                    exercise_spec["exercise_id"]
                )
                if not exercise:
                    raise ExerciseNotOwnedError(
                        f"Exercise {exercise_spec['exercise_id']} not found"
                    )
                if exercise.user_id != user_id:
                    raise ExerciseNotOwnedError(
                        f"User {user_id} does not own exercise {exercise_spec['exercise_id']}"
                    )

        # Create plan model
        plan_model = WorkoutPlanModel(
            user_id=user_id,
            name=name,
            unit_type="days",
            total_units=total_units,
        )
        self.db.add(plan_model)
        self.db.flush()  # Get the plan id without committing

        # Create days and exercises
        for day_spec in days_spec:
            day_model = PlanDayModel(
                workout_plan_id=plan_model.id,
                label=day_spec.label,
                order_position=day_spec.order_position,
                is_rest=day_spec.is_rest,
            )
            self.db.add(day_model)
            self.db.flush()  # Get the day id

            # Add exercises for this day
            for order_num, exercise_spec in enumerate(day_spec.exercises, start=1):
                exercise_model = WorkoutExerciseModel(
                    plan_day_id=day_model.id,
                    exercise_id=exercise_spec["exercise_id"],
                    order_number=order_num,
                    target_sets=exercise_spec.get("target_sets"),
                    target_reps=exercise_spec.get("target_reps"),
                    target_weight=exercise_spec.get("target_weight"),
                    target_duration_seconds=exercise_spec.get("target_duration_seconds"),
                    notes=exercise_spec.get("notes", ""),
                    has_reps=exercise_spec.get("has_reps", True),
                    has_weight=exercise_spec.get("has_weight", True),
                    has_duration=exercise_spec.get("has_duration", False),
                )
                self.db.add(exercise_model)
                self.db.flush()  # Get the exercise id for set_targets

                # Add per-set targets if provided
                for set_target_spec in exercise_spec.get("set_targets", []):
                    set_target_model = WorkoutExerciseSetTargetModel(
                        workout_exercise_id=exercise_model.id,
                        set_number=set_target_spec["set_number"],
                        target_reps=set_target_spec.get("target_reps"),
                        target_weight=set_target_spec.get("target_weight"),
                        target_duration_seconds=set_target_spec.get("target_duration_seconds"),
                    )
                    self.db.add(set_target_model)

        # Single commit at the end
        self.db.commit()
        return plan_model.to_domain()

    def _build_weeks_plan(
        self,
        user_id: int,
        name: str,
        total_units: int,
        weeks_spec: list[BuildPlanWeekSpec],
    ) -> WorkoutPlan:
        """Build a weeks-type plan."""
        # Validate total_units matches
        if len(weeks_spec) != total_units:
            raise TotalUnitsMismatchError(
                f"Expected {total_units} weeks but got {len(weeks_spec)}"
            )

        # Validate week modes
        base_count = sum(1 for w in weeks_spec if w.mode == "base")
        if base_count != 1:
            raise InvalidWeekModeError("Exactly one week must have mode='base'")

        base_week = next((w for w in weeks_spec if w.mode == "base"), None)
        if base_week.week_number != 1:
            raise InvalidWeekModeError("Week 1 must have mode='base'")

        # Validate linked weeks don't have days
        for week_spec in weeks_spec:
            if week_spec.mode == "linked" and week_spec.days:
                raise LinkedWeekWithDaysError(
                    f"Week {week_spec.week_number} is linked but includes days"
                )

        # Validate all exercises are owned by user
        for week_spec in weeks_spec:
            for day_spec in week_spec.days:
                for exercise_spec in day_spec.exercises:
                    exercise = self.exercise_repository_domain.get_by_id(
                        exercise_spec["exercise_id"]
                    )
                    if not exercise:
                        raise ExerciseNotOwnedError(
                            f"Exercise {exercise_spec['exercise_id']} not found"
                        )
                    if exercise.user_id != user_id:
                        raise ExerciseNotOwnedError(
                            f"User {user_id} does not own exercise {exercise_spec['exercise_id']}"
                        )

        # Create plan model
        plan_model = WorkoutPlanModel(
            user_id=user_id,
            name=name,
            unit_type="weeks",
            total_units=total_units,
        )
        self.db.add(plan_model)
        self.db.flush()  # Get the plan id

        # Create weeks
        week_models = {}
        for week_spec in weeks_spec:
            week_model = PlanWeekModel(
                workout_plan_id=plan_model.id,
                week_number=week_spec.week_number,
                mode=week_spec.mode,
            )
            self.db.add(week_model)
            self.db.flush()  # Get the week id
            week_models[week_spec.week_number] = week_model

        # Create days and exercises for base and custom weeks only
        for week_spec in weeks_spec:
            if week_spec.mode in ("base", "custom"):
                week_model = week_models[week_spec.week_number]
                for day_spec in week_spec.days:
                    day_model = PlanDayModel(
                        workout_plan_id=plan_model.id,
                        label=day_spec.label,
                        order_position=day_spec.order_position,
                        is_rest=day_spec.is_rest,
                        plan_week_id=week_model.id,
                    )
                    self.db.add(day_model)
                    self.db.flush()  # Get the day id

                    # Add exercises for this day
                    for order_num, exercise_spec in enumerate(day_spec.exercises, start=1):
                        exercise_model = WorkoutExerciseModel(
                            plan_day_id=day_model.id,
                            exercise_id=exercise_spec["exercise_id"],
                            order_number=order_num,
                            target_sets=exercise_spec.get("target_sets"),
                            target_reps=exercise_spec.get("target_reps"),
                            target_weight=exercise_spec.get("target_weight"),
                            target_duration_seconds=exercise_spec.get("target_duration_seconds"),
                            notes=exercise_spec.get("notes", ""),
                            has_reps=exercise_spec.get("has_reps", True),
                            has_weight=exercise_spec.get("has_weight", True),
                            has_duration=exercise_spec.get("has_duration", False),
                        )
                        self.db.add(exercise_model)
                        self.db.flush()  # Get the exercise id for set_targets

                        # Add per-set targets if provided
                        for set_target_spec in exercise_spec.get("set_targets", []):
                            set_target_model = WorkoutExerciseSetTargetModel(
                                workout_exercise_id=exercise_model.id,
                                set_number=set_target_spec["set_number"],
                                target_reps=set_target_spec.get("target_reps"),
                                target_weight=set_target_spec.get("target_weight"),
                                target_duration_seconds=set_target_spec.get("target_duration_seconds"),
                            )
                            self.db.add(set_target_model)

        # Single commit at the end
        self.db.commit()
        return plan_model.to_domain()
