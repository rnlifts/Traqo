from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint

from src.infrastructure.database import Base


class ExerciseModel(Base):
    """SQLAlchemy model for the exercises table."""

    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    muscle_group = Column(String(50), nullable=True)
    equipment = Column(String(100), nullable=True)
    video_url = Column(String(500), nullable=True)
    # One of: "weight_reps", "reps_only", "weight_only", "cardio"
    logging_type = Column(String(20), nullable=False, default="weight_reps")

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_exercises_user_id_name"),)
