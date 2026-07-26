from datetime import datetime

from ...domain.entities.workout_set import WorkoutSet
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository


class GetPreviousPerformance:
    """Use case: retrieve the most recent finished session for a plan day and group its sets by exercise."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository

    def execute(
        self, plan_day_id: int, exclude_session_id: int | None = None
    ) -> tuple[datetime | None, dict[int, list[WorkoutSet]]]:
        """Get the most recent finished session for a plan day and its sets grouped by workout_exercise_id.

        Args:
            plan_day_id: The plan day to find the previous session for.
            exclude_session_id: Optional session id to exclude from the search
                (e.g., the current in-progress session).

        Returns:
            Tuple of (session_date, sets_by_workout_exercise_id).
            - session_date: The started_at datetime of the previous session, or None if no previous session.
            - sets_by_workout_exercise_id: Dict mapping workout_exercise_id to list of WorkoutSet entities.
              Only includes sets with non-NULL workout_exercise_id (ambiguous sets are skipped).
              Empty dict if no previous session exists.
        """
        # Find the most recent finished session for this day
        session = self.session_repository.get_most_recent_finished_for_day(
            plan_day_id, exclude_session_id
        )

        if not session:
            return None, {}

        # Fetch all sets for this session
        sets = self.set_repository.list_by_session(session.id)

        # Group sets by workout_exercise_id (skip sets with NULL workout_exercise_id)
        sets_by_workout_exercise: dict[int, list[WorkoutSet]] = {}
        for workout_set in sets:
            # Skip sets with NULL workout_exercise_id (ambiguous historical data)
            if workout_set.workout_exercise_id is None:
                continue
            if workout_set.workout_exercise_id not in sets_by_workout_exercise:
                sets_by_workout_exercise[workout_set.workout_exercise_id] = []
            sets_by_workout_exercise[workout_set.workout_exercise_id].append(workout_set)

        return session.started_at, sets_by_workout_exercise
