"""Use case: per-day workout activity for the current Sunday-Saturday week."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from ..week_bounds import current_week_bounds
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository

DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


@dataclass
class DayActivity:
    """One day's activity in the weekly calendar."""

    day_label: str
    date: datetime
    has_workout: bool
    session_id: int | None  # First finished session that day, if any


class GetWeeklyActivity:
    """Use case: build the Sun-Sat activity calendar for the Dashboard."""

    def __init__(self, session_repository: WorkoutSessionRepository):
        self.session_repository = session_repository

    def execute(self, user_id: int, now: datetime | None = None) -> list[DayActivity]:
        """Get this week's per-day activity, Sunday through Saturday.

        Args:
            user_id: The user to build the calendar for.
            now: Override for "the current moment" (defaults to utcnow) — exists so
                tests can pin the week boundary instead of depending on wall-clock time.

        Returns:
            Exactly 7 DayActivity entries, Sunday first. A user with no sessions at
            all still gets a full 7-day list with has_workout=False everywhere —
            never an error condition, just an empty week.
        """
        now = now or datetime.utcnow()
        week_start, week_end = current_week_bounds(now)

        finished_sessions = self.session_repository.list_finished_by_user(user_id)
        week_sessions = [s for s in finished_sessions if week_start <= s.started_at < week_end]

        # Earliest session per calendar day, so a click always lands on the first
        # workout logged that day if there happened to be more than one.
        first_session_by_day: dict[int, int] = {}
        for session in sorted(week_sessions, key=lambda s: s.started_at):
            day_index = (session.started_at - week_start).days
            first_session_by_day.setdefault(day_index, session.id)

        return [
            DayActivity(
                day_label=DAY_LABELS[i],
                date=week_start + timedelta(days=i),
                has_workout=i in first_session_by_day,
                session_id=first_session_by_day.get(i),
            )
            for i in range(7)
        ]
