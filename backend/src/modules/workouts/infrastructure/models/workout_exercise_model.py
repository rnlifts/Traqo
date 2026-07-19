from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, Float, String, Text

from src.infrastructure.database import Base


class WorkoutExerciseModel(Base):
    __tablename__ = "workout_exercises"

    id = Column(Integer, primary_key=True)
    plan_day_id = Column(
        Integer, ForeignKey("plan_days.id"), nullable=False
    )
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    order_number = Column(Integer, nullable=False)
    target_sets = Column(Integer, nullable=True)
    target_reps = Column(Integer, nullable=True)
    target_weight = Column(Float, nullable=True)
    notes = Column(Text, nullable=False, default="")

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
        )
