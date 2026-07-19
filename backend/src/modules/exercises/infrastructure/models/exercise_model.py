from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from src.infrastructure.database import Base


class ExerciseModel(Base):
    """SQLAlchemy model for the exercises table."""

    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    category = Column(String(50), nullable=True)
