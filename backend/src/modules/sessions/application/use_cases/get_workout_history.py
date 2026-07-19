from dataclasses import dataclass
from datetime import datetime

from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from src.modules.workouts.domain.interfaces.workout_plan_repository import WorkoutPlanRepository


@dataclass
class WorkoutHistoryEntry:
    """DTO for a single workout history entry."""

    date: datetime
    workout_name: str
    duration_minutes: int


class GetWorkoutHistory:
    """Use case: retrieve a user's workout history (finished sessions only)."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        plan_repository: WorkoutPlanRepository,
    ):
        self.session_repository = session_repository
        self.plan_repository = plan_repository

    def execute(self, user_id: int) -> list[WorkoutHistoryEntry]:
        """Retrieve finished workout sessions for a user.

        Args:
            user_id: The user whose history to retrieve.

        Returns:
            List of WorkoutHistoryEntry DTOs, most recent first.
        """
        sessions = self.session_repository.list_finished_by_user(user_id)

        entries = []
        for session in sessions:
            plan = self.plan_repository.get_by_id(session.workout_plan_id)
            workout_name = plan.name if plan else "Deleted Plan"

            duration_minutes = int(
                (session.completed_at - session.started_at).total_seconds() // 60
            )

            entry = WorkoutHistoryEntry(
                date=session.started_at,
                workout_name=workout_name,
                duration_minutes=duration_minutes,
            )
            entries.append(entry)

        return entries
