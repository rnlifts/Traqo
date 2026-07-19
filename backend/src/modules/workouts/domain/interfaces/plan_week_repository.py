from abc import ABC, abstractmethod

from ..entities.plan_week import PlanWeek


class PlanWeekRepository(ABC):
    """Interface for plan week persistence."""

    @abstractmethod
    def create(self, plan_week: PlanWeek) -> PlanWeek:
        """Create and persist a new plan week. Returns week with id set."""
        pass

    @abstractmethod
    def get_by_id(self, week_id: int) -> PlanWeek | None:
        """Retrieve a plan week by id. Returns None if not found."""
        pass

    @abstractmethod
    def list_by_plan(self, plan_id: int) -> list[PlanWeek]:
        """Get all weeks for a plan, ordered by week_number."""
        pass

    @abstractmethod
    def update(self, plan_week: PlanWeek) -> PlanWeek:
        """Update an existing plan week."""
        pass

    @abstractmethod
    def delete(self, week_id: int) -> None:
        """Delete a plan week by id."""
        pass

    @abstractmethod
    def get_by_plan_and_week_number(self, plan_id: int, week_number: int) -> PlanWeek | None:
        """Retrieve a plan week by plan_id and week_number."""
        pass
