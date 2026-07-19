from sqlalchemy.orm import Session

from src.modules.workouts.domain.entities.workout_exercise import WorkoutExercise
from src.modules.workouts.domain.interfaces.workout_exercise_repository import (
    WorkoutExerciseRepository,
)
from src.modules.workouts.infrastructure.models.workout_exercise_model import (
    WorkoutExerciseModel,
)
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel


class WorkoutExerciseRepositoryImpl(WorkoutExerciseRepository):
    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def add(self, exercise: WorkoutExercise) -> WorkoutExercise:
        model = WorkoutExerciseModel(
            plan_day_id=exercise.plan_day_id,
            exercise_id=exercise.exercise_id,
            order_number=exercise.order_number,
            target_sets=exercise.target_sets,
            target_reps=exercise.target_reps,
            target_weight=exercise.target_weight,
            notes=exercise.notes,
        )
        self.session.add(model)
        self.session.commit()
        return model.to_domain()

    def list_by_plan(self, plan_id: int) -> list[WorkoutExercise]:
        """Get all exercises for a plan (across all days)."""
        models = (
            self.session.query(WorkoutExerciseModel)
            .join(
                PlanDayModel,
                WorkoutExerciseModel.plan_day_id == PlanDayModel.id
            )
            .filter(PlanDayModel.workout_plan_id == plan_id)
            .order_by(
                PlanDayModel.order_position,
                WorkoutExerciseModel.order_number
            )
            .all()
        )
        return [m.to_domain() for m in models]

    def list_by_day(self, day_id: int) -> list[WorkoutExercise]:
        """Get all exercises for a specific plan day."""
        models = (
            self.session.query(WorkoutExerciseModel)
            .filter_by(plan_day_id=day_id)
            .order_by(WorkoutExerciseModel.order_number)
            .all()
        )
        return [m.to_domain() for m in models]

    def get_by_id(self, workout_exercise_id: int) -> WorkoutExercise | None:
        model = self.session.query(WorkoutExerciseModel).get(workout_exercise_id)
        return model.to_domain() if model else None

    def remove(self, workout_exercise_id: int) -> None:
        model = self.session.query(WorkoutExerciseModel).get(workout_exercise_id)
        if model:
            self.session.delete(model)
            self.session.commit()

    def update_order(
        self, workout_exercise_id: int, new_order: int
    ) -> WorkoutExercise:
        model = self.session.query(WorkoutExerciseModel).get(workout_exercise_id)
        if not model:
            return None
        model.order_number = new_order
        self.session.commit()
        return model.to_domain()
