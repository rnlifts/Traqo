from ...domain.exceptions import (
    PlanDayNotFoundError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ...domain.interfaces.workout_plan_repository import WorkoutPlanRepository


class UpdateDay:
    """Use case: update a plan day's label."""

    def __init__(
        self,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
    ):
        self.plan_repository = plan_repository
        self.day_repository = day_repository

    def execute(
        self,
        plan_id: int,
        day_id: int,
        requesting_user_id: int,
        label: str | None = None,
        is_rest: bool | None = None,
        custom_name: str | None = None,
        skip_ownership_check: bool = False,
    ) -> dict:
        """Update a plan day.

        Supports partial updates: only the fields provided will be changed.

        Args:
            plan_id: The workout plan id.
            day_id: The plan day id.
            requesting_user_id: The authenticated user id.
            label: New day label (or None to leave unchanged).
            is_rest: New is_rest flag (or None to leave unchanged).
            custom_name: New custom nickname (e.g. "Chest Day"), shown
                alongside `label` rather than replacing it. None means leave
                unchanged; an empty/whitespace-only string clears it back to
                unset (unlike `label`, an empty custom_name is valid — it
                just means the day has no nickname).
            skip_ownership_check: If True, skip the ownership check (used for share-authorized paths).
                Defaults to False to preserve existing behavior.

        Returns:
            dict: The updated day data.

        Raises:
            WorkoutPlanNotFoundError: If the plan doesn't exist.
            UnauthorizedWorkoutPlanAccessError: If the user doesn't own the plan (and not skip_ownership_check).
            PlanDayNotFoundError: If the day doesn't exist or doesn't belong to the plan.
            ValueError: If the label is empty.
        """
        # Load and validate plan ownership
        plan = self.plan_repository.get_by_id(plan_id)
        if not plan:
            raise WorkoutPlanNotFoundError(f"Plan {plan_id} not found")

        if not skip_ownership_check and plan.user_id != requesting_user_id:
            raise UnauthorizedWorkoutPlanAccessError(
                f"User {requesting_user_id} does not own plan {plan_id}"
            )

        # Load and validate day
        day = self.day_repository.get_by_id(day_id)
        if not day:
            raise PlanDayNotFoundError(f"Day {day_id} not found")

        if day.workout_plan_id != plan_id:
            raise PlanDayNotFoundError(f"Day {day_id} does not belong to plan {plan_id}")

        # Update label if provided
        if label is not None:
            if not label or not label.strip():
                raise ValueError("Day label cannot be empty")
            day.label = label

        # Update is_rest if provided
        if is_rest is not None:
            day.is_rest = is_rest

        # Update custom_name if provided; empty/whitespace clears it to unset
        if custom_name is not None:
            stripped = custom_name.strip()
            day.custom_name = stripped if stripped else None

        # Update the day
        updated_day = self.day_repository.update(day)

        # Return updated day
        return {
            "id": updated_day.id,
            "label": updated_day.label,
            "order_position": updated_day.order_position,
            "is_rest": updated_day.is_rest,
            "custom_name": updated_day.custom_name,
            "created_at": updated_day.created_at,
            "updated_at": updated_day.updated_at,
        }
