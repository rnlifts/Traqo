from sqlalchemy import func
from sqlalchemy.orm import Session

from src.modules.exercise_library.domain.entities.exercise_library_item import (
    ExerciseLibraryItem,
)
from src.modules.exercise_library.domain.interfaces.exercise_library_repository import (
    ExerciseLibraryRepository,
)
from src.modules.exercise_library.infrastructure.models.exercise_library_item_model import (
    ExerciseLibraryItemModel,
)


class ExerciseLibraryRepositoryImpl(ExerciseLibraryRepository):
    """SQLAlchemy implementation of ExerciseLibraryRepository."""

    def __init__(self, db: Session):
        self.db = db

    def search(
        self, muscle_group: str | None = None
    ) -> list[ExerciseLibraryItem]:
        """Get library entries, optionally filtered by muscle_group. Ordered by name."""
        query = self.db.query(ExerciseLibraryItemModel)

        if muscle_group:
            query = query.filter(ExerciseLibraryItemModel.muscle_group == muscle_group)

        rows = query.order_by(ExerciseLibraryItemModel.name).all()
        return [self._to_domain(row) for row in rows]

    def get_distinct_muscle_groups(self) -> list[str]:
        """Get sorted list of distinct muscle_group values in the library."""
        groups = self.db.query(ExerciseLibraryItemModel.muscle_group).distinct().all()
        return sorted([g[0] for g in groups])

    def upsert(self, item: ExerciseLibraryItem) -> ExerciseLibraryItem:
        """Insert or update by (name, muscle_group). Returns the item with id set."""
        existing = self.db.query(ExerciseLibraryItemModel).filter(
            ExerciseLibraryItemModel.name == item.name,
            ExerciseLibraryItemModel.muscle_group == item.muscle_group,
        ).first()

        if existing:
            existing.equipment = item.equipment
            existing.video_url = item.video_url
            existing.image_url = item.image_url
            self.db.commit()
            return self._to_domain(existing)
        else:
            model = ExerciseLibraryItemModel(
                name=item.name,
                muscle_group=item.muscle_group,
                equipment=item.equipment,
                video_url=item.video_url,
                image_url=item.image_url,
            )
            self.db.add(model)
            self.db.commit()
            self.db.refresh(model)
            return self._to_domain(model)

    @staticmethod
    def _to_domain(model: ExerciseLibraryItemModel) -> ExerciseLibraryItem:
        """Convert SQLAlchemy model to domain entity."""
        return ExerciseLibraryItem(
            id=model.id,
            name=model.name,
            muscle_group=model.muscle_group,
            equipment=model.equipment,
            video_url=model.video_url,
            image_url=model.image_url,
            created_at=model.created_at,
        )
