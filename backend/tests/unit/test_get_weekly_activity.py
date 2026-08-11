"""Unit tests for get_weekly_activity.py — the Dashboard's Sun-Sat activity calendar."""

from datetime import datetime, timedelta

from src.modules.sessions.application.use_cases.get_weekly_activity import (
    GetWeeklyActivity,
    DAY_LABELS,
)
from src.modules.sessions.domain.entities.workout_session import WorkoutSession

# 2026-08-09 is a Sunday. Week is [2026-08-09, 2026-08-16).
WEEK_START = datetime(2026, 8, 9)
NOW = datetime(2026, 8, 11, 12, 0, 0)  # a Tuesday within the week


class InMemorySessionRepo:
    def __init__(self):
        self.sessions = {}
        self.next_id = 1

    def add_finished(self, user_id, started_at):
        session_id = self.next_id
        self.next_id += 1
        self.sessions[session_id] = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_plan_id=None,
            started_at=started_at,
            completed_at=started_at + timedelta(minutes=30),
        )
        return session_id

    def list_finished_by_user(self, user_id):
        return [s for s in self.sessions.values() if s.user_id == user_id and s.completed_at]


class TestGetWeeklyActivityEmptyWeek:
    def test_no_sessions_returns_seven_days_all_false(self):
        repo = InMemorySessionRepo()
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert len(days) == 7
        assert [d.day_label for d in days] == DAY_LABELS
        assert all(not d.has_workout for d in days)
        assert all(d.session_id is None for d in days)

    def test_days_are_in_sunday_through_saturday_order_with_correct_dates(self):
        repo = InMemorySessionRepo()
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert days[0].date == WEEK_START
        assert days[6].date == WEEK_START + timedelta(days=6)


class TestGetWeeklyActivityWithSessions:
    def test_marks_the_correct_day_as_active(self):
        repo = InMemorySessionRepo()
        # Tuesday (index 2 from Sunday).
        sid = repo.add_finished(1, WEEK_START + timedelta(days=2, hours=8))
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert days[2].has_workout is True
        assert days[2].session_id == sid
        assert days[2].day_label == "Tue"
        # Every other day stays untouched.
        assert all(not d.has_workout for i, d in enumerate(days) if i != 2)

    def test_two_sessions_same_day_uses_the_earlier_one(self):
        repo = InMemorySessionRepo()
        early_id = repo.add_finished(1, WEEK_START + timedelta(days=1, hours=6))
        repo.add_finished(1, WEEK_START + timedelta(days=1, hours=18))
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert days[1].session_id == early_id

    def test_sessions_outside_this_week_are_ignored(self):
        repo = InMemorySessionRepo()
        repo.add_finished(1, WEEK_START - timedelta(days=1))  # last Saturday
        repo.add_finished(1, WEEK_START + timedelta(days=7))  # next Sunday
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert all(not d.has_workout for d in days)

    def test_excludes_other_users_sessions(self):
        repo = InMemorySessionRepo()
        repo.add_finished(2, WEEK_START + timedelta(days=1))
        use_case = GetWeeklyActivity(repo)

        days = use_case.execute(user_id=1, now=NOW)

        assert all(not d.has_workout for d in days)
