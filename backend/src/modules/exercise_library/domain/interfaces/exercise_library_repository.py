from abc import ABC, abstractmethod

from ..entities.exercise_library_item import ExerciseLibraryItem


class ExerciseLibraryRepository(ABC):
    """Interface for exercise library persistence."""

    @abstractmethod
    def search(
        self, muscle_group: str | None = None
    ) -> list[ExerciseLibraryItem]:
        """Get library entries, optionally filtered by muscle_group. Ordered by name."""
        pass

    @abstractmethod
    def get_distinct_muscle_groups(self) -> list[str]:
        """Get sorted list of distinct muscle_group values in the library."""
        pass

    @abstractmethod
    def get_distinct_equipment(self) -> list[str]:
        """Get sorted list of distinct equipment values in the library, filtering out NULLs."""
        pass

    @abstractmethod
    def upsert(self, item: ExerciseLibraryItem) -> ExerciseLibraryItem:
        """Insert or update by (name, muscle_group). Returns the item with id set."""
        pass
