from abc import ABC, abstractmethod

from ..entities.plan_day import PlanDay


class PlanDayRepository(ABC):
    """Interface for plan day persistence."""

    @abstractmethod
    def create(self, plan_day: PlanDay) -> PlanDay:
        """Create and persist a new plan day. Returns day with id set."""
        pass

    @abstractmethod
    def get_by_id(self, day_id: int) -> PlanDay | None:
        """Retrieve a plan day by id. Returns None if not found."""
        pass

    @abstractmethod
    def list_by_plan(self, plan_id: int) -> list[PlanDay]:
        """Get all days for a plan, ordered by order_position."""
        pass

    @abstractmethod
    def update(self, plan_day: PlanDay) -> PlanDay:
        """Update an existing plan day."""
        pass

    @abstractmethod
    def delete(self, day_id: int) -> None:
        """Delete a plan day by id."""
        pass
