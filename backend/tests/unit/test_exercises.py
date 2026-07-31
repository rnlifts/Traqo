"""Unit tests for exercises module."""

import pytest
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
from src.modules.exercises.application.use_cases.update_exercise import UpdateExercise


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

    def list_by_user_custom_only(self, user_id: int) -> list[Exercise]:
        return [e for e in self.exercises.values() if e.user_id == user_id and e.is_custom]

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

    def exists_by_user_and_name_excluding_id(self, user_id: int, name: str, exclude_id: int) -> bool:
        return any(
            e.user_id == user_id and e.name.lower() == name.lower() and e.id != exclude_id
            for e in self.exercises.values()
        )

    def update(self, exercise: Exercise) -> Exercise:
        if exercise.id in self.exercises:
            self.exercises[exercise.id] = exercise
            return exercise
        return None

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

        exercise = use_case.execute(user_id, "Running", muscle_group="cardio", logging_type="cardio")

        assert exercise.logging_type == "cardio"

    def test_create_exercise_without_muscle_group(self, exercise_repo, user_id):
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
        create_use_case.execute(user_id, "Squats", muscle_group="legs", logging_type="weight_reps")

        list_use_case = ListExercises(exercise_repo)
        exercises = list_use_case.execute(user_id)

        exercise = exercises[0]
        assert exercise.id is not None
        assert exercise.user_id == user_id
        assert exercise.name == "Squats"
        assert exercise.muscle_group == "legs"
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
# UpdateExercise Tests
# ============================================================================


class TestUpdateExercise:
    """Tests for UpdateExercise use case."""

    def test_update_exercise_with_new_name(self, exercise_repo, user_id):
        """UpdateExercise updates the exercise name."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press", muscle_group="chest")

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(exercise.id, user_id, name="Incline Bench Press")

        assert updated.id == exercise.id
        assert updated.name == "Incline Bench Press"
        assert updated.muscle_group == "chest"  # Unchanged

    def test_update_exercise_with_new_metadata(self, exercise_repo, user_id):
        """UpdateExercise updates muscle_group, equipment, and video_url."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Bench Press",
            muscle_group="chest",
            equipment="barbell",
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        )

        assert updated.muscle_group == "chest"
        assert updated.equipment == "barbell"
        assert updated.video_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    def test_update_exercise_partial_fields(self, exercise_repo, user_id):
        """UpdateExercise updates only provided fields."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(
            user_id,
            "Bench Press",
            muscle_group="chest",
            equipment="barbell",
        )

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Bench Press",
            equipment="dumbbell",
        )

        assert updated.name == "Bench Press"
        assert updated.muscle_group == "chest"  # Unchanged
        assert updated.equipment == "dumbbell"

    def test_update_nonexistent_exercise_raises_error(self, exercise_repo, user_id):
        """UpdateExercise raises ExerciseNotFoundError for missing exercise."""
        update_use_case = UpdateExercise(exercise_repo)

        with pytest.raises(ExerciseNotFoundError):
            update_use_case.execute(999, user_id, name="Nonexistent")

    def test_update_exercise_wrong_owner_raises_error(self, exercise_repo, user_id, other_user_id):
        """UpdateExercise raises UnauthorizedExerciseAccessError when user doesn't own it."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        update_use_case = UpdateExercise(exercise_repo)
        with pytest.raises(UnauthorizedExerciseAccessError):
            update_use_case.execute(exercise.id, other_user_id, name="Updated")

    def test_update_exercise_duplicate_name_raises_error(self, exercise_repo, user_id):
        """UpdateExercise raises DuplicateExerciseNameError on name collision."""
        create_use_case = CreateExercise(exercise_repo)
        ex1 = create_use_case.execute(user_id, "Bench Press")
        ex2 = create_use_case.execute(user_id, "Deadlift")

        update_use_case = UpdateExercise(exercise_repo)
        with pytest.raises(DuplicateExerciseNameError):
            update_use_case.execute(ex2.id, user_id, name="Bench Press")

    def test_update_exercise_same_name_allowed(self, exercise_repo, user_id):
        """UpdateExercise allows updating to the same name."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press", muscle_group="chest")

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Bench Press",
            muscle_group="back",
        )

        assert updated.name == "Bench Press"
        assert updated.muscle_group == "back"

    def test_update_exercise_preserves_logging_type(self, exercise_repo, user_id):
        """UpdateExercise doesn't modify logging_type."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(
            user_id, "Bench Press", logging_type="weight_reps"
        )

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Updated Press",
            muscle_group="chest",
        )

        assert updated.logging_type == "weight_reps"

    def test_update_exercise_in_plan_succeeds(self, exercise_repo, user_id):
        """UpdateExercise succeeds even if exercise is used in a plan."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press")

        # Mark as used in a plan
        exercise_repo.mark_as_used(exercise.id)

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Incline Bench Press",
        )

        assert updated.name == "Incline Bench Press"

    def test_update_exercise_does_not_change_is_custom(self, exercise_repo, user_id):
        """UpdateExercise does not change is_custom field."""
        create_use_case = CreateExercise(exercise_repo)
        exercise = create_use_case.execute(user_id, "Bench Press", is_custom=True)

        update_use_case = UpdateExercise(exercise_repo)
        updated = update_use_case.execute(
            exercise.id,
            user_id,
            name="Updated Press",
            muscle_group="chest",
        )

        assert updated.is_custom is True


# ============================================================================
# TestCreateExercise - is_custom field tests
# ============================================================================


class TestCreateExerciseIsCustom:
    """Tests for is_custom field in CreateExercise use case."""

    def test_is_custom_defaults_to_true(self, exercise_repo, user_id):
        """CreateExercise defaults is_custom to True when not passed."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Bench Press")

        assert exercise.is_custom is True

    def test_is_custom_false_is_respected(self, exercise_repo, user_id):
        """CreateExercise respects is_custom=False when explicitly passed."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Bench Press", is_custom=False)

        assert exercise.is_custom is False

    def test_is_custom_true_is_respected(self, exercise_repo, user_id):
        """CreateExercise respects is_custom=True when explicitly passed."""
        use_case = CreateExercise(exercise_repo)

        exercise = use_case.execute(user_id, "Bench Press", is_custom=True)

        assert exercise.is_custom is True


# ============================================================================
# TestListByUserCustomOnly
# ============================================================================


class TestListByUserCustomOnly:
    """Tests for list_by_user_custom_only repository method."""

    def test_returns_only_custom_exercises(self, exercise_repo, user_id):
        """list_by_user_custom_only returns only exercises with is_custom=True for the user."""
        create_use_case = CreateExercise(exercise_repo)
        custom_ex = create_use_case.execute(user_id, "Bench Press", is_custom=True)
        non_custom_ex = create_use_case.execute(user_id, "Deadlift", is_custom=False)

        custom_only = exercise_repo.list_by_user_custom_only(user_id)

        assert len(custom_only) == 1
        assert custom_only[0].id == custom_ex.id
        assert custom_only[0].name == "Bench Press"
        assert custom_only[0].is_custom is True

    def test_excludes_non_custom_exercises(self, exercise_repo, user_id):
        """list_by_user_custom_only excludes exercises with is_custom=False."""
        create_use_case = CreateExercise(exercise_repo)
        create_use_case.execute(user_id, "Bench Press", is_custom=True)
        create_use_case.execute(user_id, "Deadlift", is_custom=False)
        create_use_case.execute(user_id, "Squats", is_custom=True)

        custom_only = exercise_repo.list_by_user_custom_only(user_id)

        assert len(custom_only) == 2
        names = {e.name for e in custom_only}
        assert names == {"Bench Press", "Squats"}
        assert all(e.is_custom for e in custom_only)

    def test_excludes_other_users_exercises(self, exercise_repo, user_id, other_user_id):
        """list_by_user_custom_only excludes other users' exercises even if they are custom."""
        create_use_case = CreateExercise(exercise_repo)
        user_custom = create_use_case.execute(user_id, "Bench Press", is_custom=True)
        other_custom = create_use_case.execute(other_user_id, "Deadlift", is_custom=True)

        custom_only = exercise_repo.list_by_user_custom_only(user_id)

        assert len(custom_only) == 1
        assert custom_only[0].id == user_custom.id
        assert custom_only[0].user_id == user_id

    def test_empty_when_no_custom_exercises(self, exercise_repo, user_id):
        """list_by_user_custom_only returns empty list when user has no custom exercises."""
        create_use_case = CreateExercise(exercise_repo)
        create_use_case.execute(user_id, "Bench Press", is_custom=False)
        create_use_case.execute(user_id, "Deadlift", is_custom=False)

        custom_only = exercise_repo.list_by_user_custom_only(user_id)

        assert custom_only == []

    def test_empty_when_user_has_no_exercises(self, exercise_repo, user_id):
        """list_by_user_custom_only returns empty list when user has no exercises at all."""
        custom_only = exercise_repo.list_by_user_custom_only(user_id)

        assert custom_only == []
