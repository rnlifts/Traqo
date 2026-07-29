from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint, Index

from src.infrastructure.database import Base


class ExerciseLibraryItemModel(Base):
    """SQLAlchemy model for the exercise_library_items table."""

    __tablename__ = "exercise_library_items"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    muscle_group = Column(String(50), nullable=False, index=True)
    equipment = Column(String(100), nullable=True)
    video_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("name", "muscle_group", name="uq_library_name_muscle"),
    )
