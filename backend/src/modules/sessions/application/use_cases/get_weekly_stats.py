"""Use case: this week's workout count, total volume, and PR count for the Dashboard."""

from dataclasses import dataclass
from datetime import datetime

from ..week_bounds import current_week_bounds
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from .get_exercise_progress import GetExerciseProgress


@dataclass
class WeeklyStats:
    """Summary stats for the current Sunday-Saturday week."""

    workout_count: int
    total_volume: float
    pr_count: int


class GetWeeklyStats:
    """Use case: compute this week's workout count, total volume, and PR count.

    Volume and workout count come straight from this week's finished sessions/sets.
    PR count reuses GetExerciseProgress's existing per-exercise PR-detection logic
    (rather than re-implementing "running max" comparisons here) — only exercises
    actually touched this week need checking, since a PR is necessarily tied to a
    specific exercise's own chronological history.
    """

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        exercise_progress_use_case: GetExerciseProgress,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository
        self.exercise_progress_use_case = exercise_progress_use_case

    def execute(self, user_id: int, now: datetime | None = None) -> WeeklyStats:
        """Compute this week's stats for a user.

        Args:
            user_id: The user to compute stats for.
            now: Override for "the current moment" (defaults to utcnow) — exists so
                tests can pin the week boundary instead of depending on wall-clock time.

        Returns:
            WeeklyStats with workout_count, total_volume, and pr_count all defaulting
            to 0 for a user with no activity this week (never an error condition).
        """
        now = now or datetime.utcnow()
        week_start, week_end = current_week_bounds(now)

        finished_sessions = self.session_repository.list_finished_by_user(user_id)
        week_sessions = [s for s in finished_sessions if week_start <= s.started_at < week_end]

        workout_count = len(week_sessions)

        total_volume = 0.0
        exercise_ids_this_week: set[int] = set()
        for session in week_sessions:
            for s in self.set_repository.list_by_session(session.id):
                exercise_ids_this_week.add(s.exercise_id)
                if s.weight is not None and s.reps is not None:
                    total_volume += s.weight * s.reps

        pr_count = 0
        for exercise_id in exercise_ids_this_week:
            try:
                progress = self.exercise_progress_use_case.execute(user_id, exercise_id)
            except Exception:
                # An exercise deleted/reassigned mid-computation shouldn't take down
                # the whole weekly-stats card — just skip its PR contribution.
                continue

            for entry in progress.sessions:
                if not (week_start <= entry.date < week_end):
                    continue
                if entry.is_volume_pr:
                    pr_count += 1
                for pset in entry.sets:
                    if pset.is_weight_pr or pset.is_reps_pr or pset.is_e1rm_pr:
                        pr_count += 1

        return WeeklyStats(
            workout_count=workout_count,
            total_volume=total_volume,
            pr_count=pr_count,
        )
