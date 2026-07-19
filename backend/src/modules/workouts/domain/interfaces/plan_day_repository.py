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

    @abstractmethod
    def get_weekdays_for_day(self, day_id: int) -> list[str]:
        """Get list of weekdays assigned to a plan day (e.g., ['Monday', 'Thursday'])."""
        pass

    @abstractmethod
    def add_weekday(self, day_id: int, weekday: str) -> None:
        """Add a weekday to a plan day."""
        pass

    @abstractmethod
    def remove_weekday(self, day_id: int, weekday: str) -> None:
        """Remove a weekday from a plan day."""
        pass

    @abstractmethod
    def clear_weekdays(self, day_id: int) -> None:
        """Remove all weekdays from a plan day."""
        pass

    @abstractmethod
    def get_days_by_weekday_in_plan(self, plan_id: int, weekday: str) -> list[PlanDay]:
        """Get all days in a plan that are tagged to a specific weekday."""
        pass
