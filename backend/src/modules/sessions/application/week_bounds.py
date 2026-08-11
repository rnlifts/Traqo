"""Shared Sunday-Saturday week boundary calculation.

Used by both GetWeeklyStats and GetWeeklyActivity so the two can never drift apart
on what "this week" means. All boundaries are naive UTC, matching how the rest of
the codebase stores `started_at`/`completed_at` (no timezone handling exists
anywhere else in the app either).
"""

from datetime import datetime, timedelta


def current_week_bounds(now: datetime) -> tuple[datetime, datetime]:
    """Return [week_start, week_end) for the Sunday-Saturday week containing `now`.

    week_start is the most recent Sunday at 00:00:00; week_end is the following
    Sunday at 00:00:00 (exclusive upper bound).
    """
    # datetime.weekday(): Monday=0 .. Sunday=6. Days since the most recent Sunday:
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = datetime(now.year, now.month, now.day) - timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end
