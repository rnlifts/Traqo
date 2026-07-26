from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, Float, String

from src.infrastructure.database import Base


class WorkoutExerciseSetTargetModel(Base):
    __tablename__ = "workout_exercise_set_targets"

    id = Column(Integer, primary_key=True)
    workout_exercise_id = Column(
        Integer, ForeignKey("workout_exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    set_number = Column(Integer, nullable=False)
    target_reps = Column(String(20), nullable=True)
    target_weight = Column(Float, nullable=True)
    target_duration_seconds = Column(Integer, nullable=True)

    __table_args__ = (UniqueConstraint("workout_exercise_id", "set_number"),)

    def to_domain(self):
        from ...domain.entities.workout_exercise_set_target import WorkoutExerciseSetTarget

        return WorkoutExerciseSetTarget(
            id=self.id,
            workout_exercise_id=self.workout_exercise_id,
            set_number=self.set_number,
            target_reps=self.target_reps,
            target_weight=self.target_weight,
            target_duration_seconds=self.target_duration_seconds,
        )
