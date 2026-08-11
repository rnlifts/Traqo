"""Unit tests for get_weekly_stats.py — Dashboard weekly KPI aggregation.

Week boundary is fixed to a known Sunday-Saturday range so tests never depend on
wall-clock time (see week_bounds.py: Sunday 00:00:00 through the following Sunday).
"""

from datetime import datetime, timedelta

from src.modules.sessions.application.use_cases.get_weekly_stats import GetWeeklyStats
from src.modules.sessions.application.use_cases.get_exercise_progress import GetExerciseProgress
from src.modules.sessions.domain.entities.workout_set import WorkoutSet
from src.modules.sessions.domain.entities.workout_session import WorkoutSession
from src.modules.exercises.domain.entities.exercise import Exercise


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

    def get_by_id(self, session_id):
        return self.sessions.get(session_id)

    def list_finished_by_user(self, user_id):
        return [s for s in self.sessions.values() if s.user_id == user_id and s.completed_at]


class InMemorySetRepo:
    def __init__(self):
        self.sets_by_session = {}
        self.all_sets = []

    def add_set(self, session_id, exercise_id, weight, reps, set_number=1):
        s = WorkoutSet(
            workout_session_id=session_id,
            exercise_id=exercise_id,
            set_number=set_number,
            weight=weight,
            reps=reps,
        )
        self.sets_by_session.setdefault(session_id, []).append(s)
        self.all_sets.append(s)
        return s

    def list_by_session(self, session_id):
        return self.sets_by_session.get(session_id, [])

    def list_finished_by_user_and_exercise(self, user_id, exercise_id):
        # Mirrors what GetExerciseProgress needs: chronological order across sessions.
        result = [s for s in self.all_sets if s.exercise_id == exercise_id]
        return result


class InMemoryExerciseRepo:
    def __init__(self):
        self.exercises = {1: Exercise(id=1, user_id=1, name="Bench Press")}

    def get_by_id(self, exercise_id):
        return self.exercises.get(exercise_id)


def make_use_case():
    session_repo = InMemorySessionRepo()
    set_repo = InMemorySetRepo()
    exercise_repo = InMemoryExerciseRepo()

    # GetExerciseProgress needs session_repo.get_by_id to resolve each session in
    # list_finished_by_user_and_exercise's results — reuse the same session_repo.
    progress_use_case = GetExerciseProgress(session_repo, set_repo, exercise_repo)
    use_case = GetWeeklyStats(session_repo, set_repo, progress_use_case)
    return use_case, session_repo, set_repo


class TestGetWeeklyStatsEmptyWeek:
    def test_no_sessions_at_all_returns_zeros(self):
        use_case, _, _ = make_use_case()
        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.workout_count == 0
        assert stats.total_volume == 0
        assert stats.pr_count == 0


class TestGetWeeklyStatsWorkoutCount:
    def test_counts_only_sessions_within_this_week(self):
        use_case, session_repo, _ = make_use_case()
        session_repo.add_finished(1, WEEK_START + timedelta(days=1))  # in week
        session_repo.add_finished(1, WEEK_START - timedelta(days=1))  # last week
        session_repo.add_finished(1, WEEK_START + timedelta(days=7))  # next week

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.workout_count == 1

    def test_excludes_other_users_sessions(self):
        use_case, session_repo, _ = make_use_case()
        session_repo.add_finished(2, WEEK_START + timedelta(days=1))

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.workout_count == 0


class TestGetWeeklyStatsVolume:
    def test_sums_weight_times_reps_across_this_weeks_sets(self):
        use_case, session_repo, set_repo = make_use_case()
        sid = session_repo.add_finished(1, WEEK_START + timedelta(days=1))
        set_repo.add_set(sid, exercise_id=1, weight=100, reps=5, set_number=1)
        set_repo.add_set(sid, exercise_id=1, weight=100, reps=5, set_number=2)

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.total_volume == 1000

    def test_sets_missing_weight_or_reps_contribute_zero_not_an_error(self):
        use_case, session_repo, set_repo = make_use_case()
        sid = session_repo.add_finished(1, WEEK_START + timedelta(days=1))
        set_repo.add_set(sid, exercise_id=1, weight=None, reps=10, set_number=1)  # bodyweight
        set_repo.add_set(sid, exercise_id=1, weight=100, reps=None, set_number=2)  # malformed
        set_repo.add_set(sid, exercise_id=1, weight=50, reps=2, set_number=3)

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.total_volume == 100

    def test_ignores_sets_from_outside_this_week(self):
        use_case, session_repo, set_repo = make_use_case()
        sid = session_repo.add_finished(1, WEEK_START - timedelta(days=1))
        set_repo.add_set(sid, exercise_id=1, weight=100, reps=5)

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.total_volume == 0


class TestGetWeeklyStatsPrCount:
    def test_counts_a_pr_set_logged_this_week(self):
        use_case, session_repo, set_repo = make_use_case()
        # First-ever set for the exercise: never a PR (matches get_exercise_progress rule).
        sid1 = session_repo.add_finished(1, WEEK_START + timedelta(days=1))
        set_repo.add_set(sid1, exercise_id=1, weight=100, reps=5, set_number=1)
        # Second set, same week, beats the first on weight (and therefore e1rm and
        # session volume too) — counts as 2 broken PRs: one set-level (weight/e1rm,
        # counted once per set regardless of how many of its flags are true) and one
        # session-level (volume), matching how get_exercise_progress reports PRs.
        sid2 = session_repo.add_finished(1, WEEK_START + timedelta(days=2))
        set_repo.add_set(sid2, exercise_id=1, weight=110, reps=5, set_number=1)

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.pr_count == 2

    def test_prior_weeks_pr_does_not_count_toward_this_week(self):
        use_case, session_repo, set_repo = make_use_case()
        sid1 = session_repo.add_finished(1, WEEK_START - timedelta(days=7))
        set_repo.add_set(sid1, exercise_id=1, weight=100, reps=5, set_number=1)
        # Beats it, but happened last week.
        sid2 = session_repo.add_finished(1, WEEK_START - timedelta(days=1))
        set_repo.add_set(sid2, exercise_id=1, weight=110, reps=5, set_number=1)

        stats = use_case.execute(user_id=1, now=NOW)

        assert stats.pr_count == 0

    def test_one_exercises_progress_lookup_failing_does_not_break_the_whole_call(self):
        """An exercise deleted mid-computation (or any lookup failure) must be
        isolated — the rest of the week's stats still come back correctly."""
        use_case, session_repo, set_repo = make_use_case()
        sid = session_repo.add_finished(1, WEEK_START + timedelta(days=1))
        # exercise_id=999 has sets but no matching Exercise row — progress lookup
        # for it will raise ExerciseNotFoundError inside GetExerciseProgress.
        set_repo.add_set(sid, exercise_id=999, weight=50, reps=5, set_number=1)

        stats = use_case.execute(user_id=1, now=NOW)

        # Workout count/volume are unaffected; pr_count just skips the broken exercise.
        assert stats.workout_count == 1
        assert stats.total_volume == 250
        assert stats.pr_count == 0
