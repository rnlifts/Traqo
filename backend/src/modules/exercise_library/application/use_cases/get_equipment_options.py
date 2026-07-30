from src.modules.exercise_library.domain.interfaces.exercise_library_repository import (
    ExerciseLibraryRepository,
)


class GetEquipmentOptions:
    """Get the list of distinct equipment options in the library."""

    def __init__(self, repository: ExerciseLibraryRepository):
        self.repository = repository

    def execute(self) -> list[str]:
        """Return sorted list of distinct equipment values."""
        return self.repository.get_distinct_equipment()
