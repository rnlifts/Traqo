from abc import ABC, abstractmethod

from ..entities.workout_plan import WorkoutPlan


class WorkoutPlanRepository(ABC):
    """Interface for workout plan persistence."""

    @abstractmethod
    def create(self, plan: WorkoutPlan) -> WorkoutPlan:
        """Create and persist a new workout plan. Returns plan with id set."""
        pass

    @abstractmethod
    def list_by_user(self, user_id: int) -> list[WorkoutPlan]:
        """Get all workout plans for a user. Returns empty list if none exist."""
        pass

    @abstractmethod
    def get_by_id(self, plan_id: int) -> WorkoutPlan | None:
        """Retrieve a plan by id. Returns None if not found."""
        pass

    @abstractmethod
    def update(self, plan: WorkoutPlan) -> WorkoutPlan:
        """Update an existing plan."""
        pass

    @abstractmethod
    def delete(self, plan_id: int) -> None:
        """Delete a plan by id."""
        pass
