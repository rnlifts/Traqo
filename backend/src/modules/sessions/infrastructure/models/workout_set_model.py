from sqlalchemy import Column, Integer, Float, String, ForeignKey

from src.infrastructure.database import Base


class WorkoutSetModel(Base):
    """SQLAlchemy model for workout_sets table."""

    __tablename__ = "workout_sets"

    id = Column(Integer, primary_key=True)
    workout_session_id = Column(
        Integer,
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    workout_exercise_id = Column(
        Integer,
        ForeignKey("workout_exercises.id", ondelete="CASCADE"),
        nullable=True,
    )
    set_number = Column(Integer, nullable=False)
    weight = Column(Float, nullable=True)
    reps = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    notes = Column(String(500), nullable=False, default="")

    def to_domain(self):
        from ...domain.entities.workout_set import WorkoutSet

        return WorkoutSet(
            id=self.id,
            workout_session_id=self.workout_session_id,
            exercise_id=self.exercise_id,
            workout_exercise_id=self.workout_exercise_id,
            set_number=self.set_number,
            weight=self.weight,
            reps=self.reps,
            duration_seconds=self.duration_seconds,
            notes=self.notes,
        )
