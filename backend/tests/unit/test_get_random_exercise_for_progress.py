"""Unit tests for get_random_exercise_for_progress.py — Dashboard progress preview pick."""

from src.modules.sessions.application.use_cases.get_random_exercise_for_progress import (
    GetRandomExerciseForProgress,
)
from src.modules.exercises.domain.entities.exercise import Exercise


class InMemorySetRepo:
    def __init__(self, exercise_ids_by_user=None):
        self.exercise_ids_by_user = exercise_ids_by_user or {}

    def list_distinct_exercise_ids_by_user(self, user_id):
        return self.exercise_ids_by_user.get(user_id, [])


class InMemoryExerciseRepo:
    def __init__(self, exercises=None):
        self.exercises = exercises or {}

    def get_by_id(self, exercise_id):
        return self.exercises.get(exercise_id)


class TestGetRandomExerciseForProgressNoHistory:
    def test_returns_none_for_a_user_with_no_logged_exercises(self):
        set_repo = InMemorySetRepo(exercise_ids_by_user={})
        exercise_repo = InMemoryExerciseRepo()
        use_case = GetRandomExerciseForProgress(set_repo, exercise_repo)

        result = use_case.execute(user_id=1)

        assert result is None


class TestGetRandomExerciseForProgressWithHistory:
    def test_returns_one_of_the_users_logged_exercises(self):
        set_repo = InMemorySetRepo(exercise_ids_by_user={1: [5, 6, 7]})
        exercise_repo = InMemoryExerciseRepo(exercises={
            5: Exercise(id=5, user_id=1, name="Bench Press"),
            6: Exercise(id=6, user_id=1, name="Squat"),
            7: Exercise(id=7, user_id=1, name="Deadlift"),
        })
        use_case = GetRandomExerciseForProgress(set_repo, exercise_repo)

        result = use_case.execute(user_id=1)

        assert result is not None
        assert result.exercise_id in {5, 6, 7}
        assert result.exercise_name in {"Bench Press", "Squat", "Deadlift"}

    def test_skips_a_deleted_exercise_and_still_returns_a_valid_pick(self):
        # exercise_id=99 has logged sets but its Exercise row is gone.
        set_repo = InMemorySetRepo(exercise_ids_by_user={1: [99, 5]})
        exercise_repo = InMemoryExerciseRepo(exercises={
            5: Exercise(id=5, user_id=1, name="Bench Press"),
        })
        use_case = GetRandomExerciseForProgress(set_repo, exercise_repo)

        result = use_case.execute(user_id=1)

        assert result is not None
        assert result.exercise_id == 5

    def test_returns_none_if_every_logged_exercise_has_been_deleted(self):
        set_repo = InMemorySetRepo(exercise_ids_by_user={1: [99, 100]})
        exercise_repo = InMemoryExerciseRepo(exercises={})
        use_case = GetRandomExerciseForProgress(set_repo, exercise_repo)

        result = use_case.execute(user_id=1)

        assert result is None
