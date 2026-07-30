"""Unit tests for exercises module."""

import pytest
from pydantic import ValidationError
from src.modules.exercises.domain.entities.exercise import Exercise
from src.modules.exercises.domain.exceptions import (
    DuplicateExerciseNameError,
    ExerciseInUseError,
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository
from src.modules.exercises.application.use_cases.create_exercise import CreateExercise
from src.modules.exercises.application.use_cases.list_exercises import ListExercises
from src.modules.exercises.application.use_cases.delete_exercise import DeleteExercise
from src.modules.exercises.presentation.schemas import CreateExerciseRequest


# ============================================================================
# Test Double Enhancement (Mock is_used_in_any_plan)
# ============================================================================


class ExerciseRepositoryDouble(ExerciseRepository):
    """Enhanced in-memory repo for testing (tracks usage)."""

    def __init__(self):
        self.exercises = {}
        self.next_id = 1
        self.used_exercises = set()  # Track which exercises are marked as "in use"

    def create(self, exercise: Exercise) -> Exercise:
        ex_id = self.next_id
        self.next_id += 1
        exercise.id = ex_id
        self.exercises[ex_id] = exercise
        return exercise

    def list_by_user(self, user_id: int) -> list[Exercise]:
        return [e for e in self.exercises.values() if e.user_id == user_id]

    def get_by_id(self, exercise_id: int) -> Exercise | None:
        return self.exercises.get(exercise_id)

    def delete(self, exercise_id: int) -> None:
        if exercise_id in self.exercises:
            del self.exercises[exercise_id]
            self.used_exercises.discard(exercise_id)

    def is_used_in_any_plan(self, exercise_id: int) -> bool:
        return exercise_id in self.used_exercises

    def exists_by_user_and_name(self, user_id: int, name: str) -> bool:
        return any(
            e.user_id == user_id and e.name.lower() == name.lower()
            for e in self.exercises.values()
        )

    def mark_as_used(self, exercise_id: int) -> None:
        """Test helper: mark exercise as used in a plan."""
        self.used_exercises.add(exercise_id)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def exercise_repo():
    """Provide an in-memory ExerciseRepository."""
    return ExerciseRepositoryDouble()


@pytest.fixture
def user_id():
    """Provide a test user ID."""
    return 1


@pytest.fixture
def other_user_id():
    """Provide a different user ID."""
    return 2


# ============================================================================
# CreateExercise Tests
# ============================================================================


class TestCreateExercise:
    """Tests for CreateExercise use case."""

    def test_create_exercise_with_valid_data(self, exercise_repo, user_id):
        """CreateExercise creates a new exercise with valid data."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Bench Press", muscle_group="chest")

        assert exercise.id == 1
        assert exercise.user_id == user_id
        assert exercise.name == "Bench Press"
        assert exercise.muscle_group == "chest"
        assert exercise.logging_type == "weight_reps"  # default

    def test_create_exercise_with_custom_logging_type(self, exercise_repo, user_id):
        """CreateExercise respects custom logging_type parameter."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Running", muscle_group="back", logging_type="cardio")

        assert exercise.logging_type == "cardio"

    def test_create_exercise_without_category(self, exercise_repo, user_id):
        """CreateExercise allows creating exercise without muscle_group."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Mystery Exercise")

        assert exercise.muscle_group is None
        assert exercise.name == "Mystery Exercise"

    def test_create_duplicate_exercise_raises_error(self, exercise_repo, user_id):
        """CreateExercise raises DuplicateExerciseNameError when name exists for user."""
        use_case = CreateExercise(exercise_repo)

        # Create first exercise
        use_case.execute(user_id, "Bench Press")

        # Try to create duplicate
        with pytest.raises(DuplicateExerciseNameError):
            use_case.execute(user_id, "Bench Press")

    def test_create_duplicate_exercise_case_insensitive(self, exercise_repo, user_id):
        """CreateExercise checks duplicates case-insensitively."""
        use_case = CreateExercise(exercise_repo)

        use_case.execute(user_id, "Bench Press")

        # Try with different case
        with pytest.raises(DuplicateExerciseNameError):
            use_case.execute(user_id, "BENCH PRESS")

    def test_different_users_can_use_same_exercise_name(self, exercise_repo, user_id, other_user_id):
        """Different users can create exercises with the same name."""
        use_case = CreateExercise(exercise_repo)

        ex1 = use_case.execute(user_id, "Bench Press")
        ex2 = use_case.execute(other_user_id, "Bench Press")

        assert ex1.user_id == user_id
        assert ex2.user_id == other_user_id
        assert ex1.id != ex2.id

    def test_create_multiple_exercises_for_same_user(self, exercise_repo, user_id):
        """User can create multiple exercises with different names."""
        use_case = CreateExercise(exercise_repo)

        ex1 = use_case.execute(user_id, "Bench Press")
        ex2 = use_case.execute(user_id, "Deadlift")

        assert ex1.id == 1
        assert ex2.id == 2
        assert ex1.name != ex2.name


# ============================================================================
# ListExercises Tests
# ============================================================================


class TestListExercises:
    """Tests for ListExercises use case."""

    def test_list_exercises_for_user(self, exercise_repo, user_id):
        """ListExercises returns all exercises for a user."""
        create_use_case = CreateExercise(exercise_repo)
        create_use_case.execute(user_id, "Bench Press")
        create_use_case.execute(user_id, "Deadlift")

        list_use_case = ListExercises(exercise_repo)
        exercises = list_use_case.execute(user_id)

        assert len(exercises) == 2
        names = {e.name for e in exercises}
        assert names == {"Bench Press", "Deadlift"}

    def test_list_exercises_empty_for_user_with_no_exercises(self, exercise_repo, user_id):
        """ListExercises returns empty list when user has no exercises."""
        list_use_case = ListExercises(exercise_repo)

        exercises = list_use_case.execute(user_id)

        assert exercises == []

    def test_list_exercises_excludes_other_users_exercises(self, exercise_repo, user_id, other_user_id):
        """ListExercises only returns exercises for the requested user."""
        create_use_case = CreateExercise(exercise_repo)

        # Create exercises for user 1
        create_use_case.execute(user_id, "Bench Press")

        # Create exercises for user 2
        create_use_case.execute(other_user_id, "Deadlift")

        # List for user 1
        list_use_case = ListExercises(exercise_repo)
        exercises = list_use_case.execute(user_id)

        assert len(exercises) == 1
        assert exercises[0].name == "Bench Press"
        assert exercises[0].user_id == user_id

    def test_list_exercises_returns_all_fields(self, exercise_repo, user_id):
        """ListExercises returns complete Exercise entities."""
        create_use_case = CreateExercise(exercise_repo)
        create_use_case.execute(user_id, "Squats", muscle_group="quads", logging_type="weight_reps")

        list_use_case = ListExercises(exercise_repo)
        exercises = list_use_case.execute(user_id)

        exercise = exercises[0]
        assert exercise.id is not None
        assert exercise.user_id == user_id
        assert exercise.name == "Squats"
        assert exercise.muscle_group == "quads"
        assert exercise.logging_type == "weight_reps"


# ============================================================================
# DeleteExercise Tests
# ============================================================================


class TestDeleteExercise:
    """Tests for DeleteExercise use case."""

    def test_delete_exercise_owner_can_delete(self, exercise_repo, user_id):
        """DeleteExercise succeeds when owner deletes their own exercise."""
        # Create exercise
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        # Delete it
        delete_use_case = DeleteExercise(exercise_repo)
        delete_use_case.execute(exercise.id, user_id)

        # Verify it's gone
        assert exercise_repo.get_by_id(exercise.id) is None

    def test_delete_nonexistent_exercise_raises_error(self, exercise_repo, user_id):
        """DeleteExercise raises ExerciseNotFoundError when exercise doesn't exist."""
        delete_use_case = DeleteExercise(exercise_repo)

        with pytest.raises(ExerciseNotFoundError):
            delete_use_case.execute(999, user_id)

    def test_delete_exercise_wrong_owner_raises_error(self, exercise_repo, user_id, other_user_id):
        """DeleteExercise raises UnauthorizedExerciseAccessError when deleter doesn't own exercise."""
        # User 1 creates exercise
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        # User 2 tries to delete it
        delete_use_case = DeleteExercise(exercise_repo)
        with pytest.raises(UnauthorizedExerciseAccessError):
            delete_use_case.execute(exercise.id, other_user_id)

        # Exercise should still exist
        assert exercise_repo.get_by_id(exercise.id) is not None

    def test_delete_exercise_in_use_raises_error(self, exercise_repo, user_id):
        """DeleteExercise raises ExerciseInUseError when exercise is in a plan."""
        # Create exercise
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        # Mark it as used in a plan
        exercise_repo.mark_as_used(exercise.id)

        # Try to delete it
        delete_use_case = DeleteExercise(exercise_repo)
        with pytest.raises(ExerciseInUseError):
            delete_use_case.execute(exercise.id, user_id)

        # Exercise should still exist
        assert exercise_repo.get_by_id(exercise.id) is not None

    def test_delete_multiple_exercises(self, exercise_repo, user_id):
        """DeleteExercise can delete multiple exercises sequentially."""
        create_use_case = CreateExercise(exercise_repo)
        ex1 = create_use_case.execute(user_id, "Bench Press")
        ex2 = create_use_case.execute(user_id, "Deadlift")

        delete_use_case = DeleteExercise(exercise_repo)
        delete_use_case.execute(ex1.id, user_id)
        delete_use_case.execute(ex2.id, user_id)

        assert exercise_repo.get_by_id(ex1.id) is None
        assert exercise_repo.get_by_id(ex2.id) is None

    def test_delete_one_exercise_leaves_others_intact(self, exercise_repo, user_id):
        """DeleteExercise only deletes the target exercise."""
        create_use_case = CreateExercise(exercise_repo)
        ex1 = create_use_case.execute(user_id, "Bench Press")
        ex2 = create_use_case.execute(user_id, "Deadlift")

        delete_use_case = DeleteExercise(exercise_repo)
        delete_use_case.execute(ex1.id, user_id)

        # ex1 should be gone, ex2 should remain
        assert exercise_repo.get_by_id(ex1.id) is None
        assert exercise_repo.get_by_id(ex2.id) is not None
        assert exercise_repo.get_by_id(ex2.id).name == "Deadlift"


# ============================================================================
# CreateExercise Metadata Tests (Task 44)
# ============================================================================


class TestCreateExerciseMetadata:
    """Tests for exercise metadata (muscle_group, equipment, video_url)."""

    def test_create_exercise_with_muscle_group_and_equipment(self, exercise_repo, user_id):
        """CreateExercise persists muscle_group and equipment."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(
            user_id,
            "Barbell Bench Press",
            muscle_group="chest",
            equipment="barbell",
        )

        assert exercise.muscle_group == "chest"
        assert exercise.equipment == "barbell"
        assert exercise.video_url is None

    def test_create_exercise_with_all_metadata(self, exercise_repo, user_id):
        """CreateExercise persists all metadata fields."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(
            user_id,
            "Dumbbell Curl",
            muscle_group="biceps",
            equipment="dumbbell",
            video_url="https://www.youtube.com/watch?v=G-f81Mg6bAc",
        )

        assert exercise.muscle_group == "biceps"
        assert exercise.equipment == "dumbbell"
        assert exercise.video_url == "https://www.youtube.com/watch?v=G-f81Mg6bAc"

    def test_list_exercises_includes_metadata(self, exercise_repo, user_id):
        """ListExercises returns metadata fields for all exercises."""
        create_use_case = CreateExercise(exercise_repo)
        create_use_case.execute(user_id, "Exercise 1", muscle_group="chest")
        create_use_case.execute(user_id, "Exercise 2", equipment="barbell")
        create_use_case.execute(user_id, "Exercise 3")

        list_use_case = ListExercises(exercise_repo)
        exercises = list_use_case.execute(user_id)

        assert exercises[0].muscle_group == "chest"
        assert exercises[0].equipment is None
        assert exercises[1].muscle_group is None
        assert exercises[1].equipment == "barbell"
        assert exercises[2].muscle_group is None
        assert exercises[2].equipment is None


# ============================================================================
# YouTube URL Validation Tests (Task 44)
# ============================================================================


class TestYoutubeUrlValidation:
    """Tests for video_url YouTube URL validation in CreateExerciseRequest."""

    def test_valid_youtube_watch_url(self):
        """CreateExerciseRequest accepts standard youtube.com/watch URLs."""
        req = CreateExerciseRequest(
            name="Exercise",
            video_url="https://www.youtube.com/watch?v=G-f81Mg6bAc",
        )
        assert req.video_url == "https://www.youtube.com/watch?v=G-f81Mg6bAc"

    def test_valid_youtube_watch_url_without_www(self):
        """CreateExerciseRequest accepts youtube.com/watch URLs without www."""
        req = CreateExerciseRequest(
            name="Exercise",
            video_url="https://youtube.com/watch?v=G-f81Mg6bAc",
        )
        assert req.video_url == "https://youtube.com/watch?v=G-f81Mg6bAc"

    def test_valid_youtube_shorturl(self):
        """CreateExerciseRequest accepts youtu.be/ shortened URLs."""
        req = CreateExerciseRequest(
            name="Exercise",
            video_url="https://youtu.be/G-f81Mg6bAc",
        )
        assert req.video_url == "https://youtu.be/G-f81Mg6bAc"

    def test_valid_youtube_mobile_url(self):
        """CreateExerciseRequest accepts m.youtube.com URLs."""
        req = CreateExerciseRequest(
            name="Exercise",
            video_url="https://m.youtube.com/watch?v=G-f81Mg6bAc",
        )
        assert req.video_url == "https://m.youtube.com/watch?v=G-f81Mg6bAc"

    def test_valid_youtube_url_with_timestamp(self):
        """CreateExerciseRequest accepts YouTube URLs with query params like &t=30s."""
        req = CreateExerciseRequest(
            name="Exercise",
            video_url="https://www.youtube.com/watch?v=G-f81Mg6bAc&t=30s",
        )
        assert req.video_url == "https://www.youtube.com/watch?v=G-f81Mg6bAc&t=30s"

    def test_invalid_vimeo_url(self):
        """CreateExerciseRequest rejects Vimeo URLs."""
        with pytest.raises(ValidationError) as exc_info:
            CreateExerciseRequest(
                name="Exercise",
                video_url="https://vimeo.com/123456789",
            )
        assert "valid YouTube link" in str(exc_info.value)

    def test_invalid_generic_url(self):
        """CreateExerciseRequest rejects generic URLs."""
        with pytest.raises(ValidationError) as exc_info:
            CreateExerciseRequest(
                name="Exercise",
                video_url="https://example.com/video",
            )
        assert "valid YouTube link" in str(exc_info.value)

    def test_invalid_plain_text(self):
        """CreateExerciseRequest rejects plain text that isn't a URL."""
        with pytest.raises(ValidationError) as exc_info:
            CreateExerciseRequest(
                name="Exercise",
                video_url="not-a-url",
            )
        assert "valid YouTube link" in str(exc_info.value)

    def test_video_url_none_is_valid(self):
        """CreateExerciseRequest accepts None for video_url."""
        req = CreateExerciseRequest(name="Exercise", video_url=None)
        assert req.video_url is None

    def test_video_url_empty_string_is_valid(self):
        """CreateExerciseRequest accepts empty string for video_url."""
        req = CreateExerciseRequest(name="Exercise", video_url="")
        assert req.video_url == ""
