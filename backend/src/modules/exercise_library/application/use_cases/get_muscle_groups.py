from src.modules.exercise_library.domain.interfaces.exercise_library_repository import (
    ExerciseLibraryRepository,
)


class GetMuscleGroups:
    """Get the list of distinct muscle groups in the library."""

    def __init__(self, repository: ExerciseLibraryRepository):
        self.repository = repository

    def execute(self) -> list[str]:
        """Return sorted list of distinct muscle_group values."""
        return self.repository.get_distinct_muscle_groups()
