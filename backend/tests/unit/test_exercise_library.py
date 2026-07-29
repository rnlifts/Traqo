"""Unit tests for exercise library module."""

import pytest
from src.modules.exercise_library.domain.entities.exercise_library_item import ExerciseLibraryItem
from src.modules.exercise_library.application.use_cases.search_exercises import SearchExercises
from src.modules.exercise_library.application.use_cases.get_muscle_groups import GetMuscleGroups


class TestSearchExercises:
    """Tests for SearchExercises use case."""

    def test_exact_match(self, in_memory_exercise_library_repo):
        """Exact match for query should be found."""
        # Setup
        library_item = ExerciseLibraryItem(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        in_memory_exercise_library_repo.upsert(library_item)

        use_case = SearchExercises(in_memory_exercise_library_repo)

        # Execute
        results = use_case.execute("Bench Press")

        # Verify
        assert len(results) == 1
        assert results[0].name == "Bench Press"

    def test_substring_match_long_word(self, in_memory_exercise_library_repo):
        """Substring match allowed for words >= 3 chars.

        This is the "lat pull down" vs. "Pulldown" case from live verification.
        Searching "pulldown" should match "Pulldown" (exact) and also fuzzy results.
        """
        library_item1 = ExerciseLibraryItem(
            name="Pulldown",
            muscle_group="Back",
            equipment="Machine",
            video_url=None,
            image_url=None,
        )
        library_item2 = ExerciseLibraryItem(
            name="Lat Pull Down from 2 inch block",
            muscle_group="Back",
            equipment="Dumbbell",
            video_url=None,
            image_url=None,
        )
        in_memory_exercise_library_repo.upsert(library_item1)
        in_memory_exercise_library_repo.upsert(library_item2)

        use_case = SearchExercises(in_memory_exercise_library_repo)

        # Execute - search for "pulldown"
        results = use_case.execute("pulldown")

        # Verify - both should appear (exact + fuzzy)
        names = [r.name for r in results]
        assert "Pulldown" in names
        assert "Lat Pull Down from 2 inch block" in names

    def test_short_word_exact_match_only(self, in_memory_exercise_library_repo):
        """Short words (< 3 chars) require exact match to prevent false positives.

        This is the "T Bar Row" shouldn't match query "lat" case.
        """
        library_item1 = ExerciseLibraryItem(
            name="T Bar Row",
            muscle_group="Back",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        library_item2 = ExerciseLibraryItem(
            name="Lat Pulldown",
            muscle_group="Back",
            equipment="Machine",
            video_url=None,
            image_url=None,
        )
        in_memory_exercise_library_repo.upsert(library_item1)
        in_memory_exercise_library_repo.upsert(library_item2)

        use_case = SearchExercises(in_memory_exercise_library_repo)

        # Execute - search for "lat" (2 chars, short)
        results = use_case.execute("lat")

        # Verify - should NOT match "T Bar Row" (doesn't have "lat")
        names = [r.name for r in results]
        assert "T Bar Row" not in names
        assert "Lat Pulldown" in names

    def test_no_matches(self, in_memory_exercise_library_repo):
        """Search with no matches returns empty list."""
        library_item = ExerciseLibraryItem(
            name="Bench Press",
            muscle_group="Chest",
            equipment="Barbell",
            video_url=None,
            image_url=None,
        )
        in_memory_exercise_library_repo.upsert(library_item)

        use_case = SearchExercises(in_memory_exercise_library_repo)

        # Execute
        results = use_case.execute("Nonexistent Exercise")

        # Verify
        assert results == []

    def test_empty_query_returns_all(self, in_memory_exercise_library_repo):
        """Empty query returns all exercises."""
        items = [
            ExerciseLibraryItem(name="Bench Press", muscle_group="Chest", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItem(name="Deadlift", muscle_group="Back", equipment="Barbell", video_url=None, image_url=None),
        ]
        for item in items:
            in_memory_exercise_library_repo.upsert(item)

        use_case = SearchExercises(in_memory_exercise_library_repo)

        # Execute
        results = use_case.execute("")

        # Verify
        assert len(results) == 2


class TestGetMuscleGroups:
    """Tests for GetMuscleGroups use case."""

    def test_returns_sorted_distinct_groups(self, in_memory_exercise_library_repo):
        """Returns sorted, distinct muscle groups."""
        items = [
            ExerciseLibraryItem(name="Bench Press", muscle_group="Chest", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItem(name="Incline Press", muscle_group="Chest", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItem(name="Deadlift", muscle_group="Back", equipment="Barbell", video_url=None, image_url=None),
            ExerciseLibraryItem(name="Squat", muscle_group="Legs", equipment="Barbell", video_url=None, image_url=None),
        ]
        for item in items:
            in_memory_exercise_library_repo.upsert(item)

        use_case = GetMuscleGroups(in_memory_exercise_library_repo)

        # Execute
        groups = use_case.execute()

        # Verify
        assert groups == ["Back", "Chest", "Legs"]  # Sorted

    def test_empty_library(self, in_memory_exercise_library_repo):
        """Empty library returns empty list."""
        use_case = GetMuscleGroups(in_memory_exercise_library_repo)

        # Execute
        groups = use_case.execute()

        # Verify
        assert groups == []
