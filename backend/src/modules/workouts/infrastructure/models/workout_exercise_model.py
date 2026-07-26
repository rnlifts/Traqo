from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, Float, String, Text, Boolean

from src.infrastructure.database import Base


class WorkoutExerciseModel(Base):
    __tablename__ = "workout_exercises"

    id = Column(Integer, primary_key=True)
    plan_day_id = Column(
        Integer, ForeignKey("plan_days.id"), nullable=False, index=True
    )
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    order_number = Column(Integer, nullable=False)
    target_sets = Column(Integer, nullable=True)
    target_reps = Column(String(20), nullable=True)
    target_weight = Column(Float, nullable=True)
    notes = Column(Text, nullable=False, default="")
    has_reps = Column(Boolean, nullable=False, default=True)
    has_weight = Column(Boolean, nullable=False, default=True)
    has_duration = Column(Boolean, nullable=False, default=False)
    target_duration_seconds = Column(Integer, nullable=True)

    __table_args__ = (UniqueConstraint("plan_day_id", "order_number"),)

    def to_domain(self):
        from ...domain.entities.workout_exercise import WorkoutExercise

        return WorkoutExercise(
            id=self.id,
            plan_day_id=self.plan_day_id,
            exercise_id=self.exercise_id,
            order_number=self.order_number,
            target_sets=self.target_sets,
            target_reps=self.target_reps,
            target_weight=self.target_weight,
            notes=self.notes,
            has_reps=self.has_reps,
            has_weight=self.has_weight,
            has_duration=self.has_duration,
            target_duration_seconds=self.target_duration_seconds,
        )
