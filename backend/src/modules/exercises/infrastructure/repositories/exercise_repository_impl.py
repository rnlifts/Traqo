from sqlalchemy.orm import Session

from ...domain.entities.exercise import Exercise
from ...domain.interfaces.exercise_repository import ExerciseRepository
from ..models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import (
    WorkoutExerciseModel,
)


class ExerciseRepositoryImpl(ExerciseRepository):
    """Implements ExerciseRepository against SQLAlchemy."""

    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def create(self, exercise: Exercise) -> Exercise:
        """Create and persist a new exercise."""
        model = ExerciseModel(
            user_id=exercise.user_id,
            name=exercise.name,
            created_at=exercise.created_at,
            muscle_group=exercise.muscle_group,
            equipment=exercise.equipment,
            video_url=exercise.video_url,
            logging_type=exercise.logging_type,
        )
        self.session.add(model)
        self.session.commit()
        return self._model_to_entity(model)

    def list_by_user(self, user_id: int) -> list[Exercise]:
        """Get all exercises for a user."""
        models = self.session.query(ExerciseModel).filter_by(user_id=user_id).all()
        return [self._model_to_entity(model) for model in models]

    def get_by_id(self, exercise_id: int) -> Exercise | None:
        """Retrieve an exercise by id."""
        model = self.session.query(ExerciseModel).get(exercise_id)
        if not model:
            return None
        return self._model_to_entity(model)

    def delete(self, exercise_id: int) -> None:
        """Delete an exercise by id."""
        model = self.session.query(ExerciseModel).get(exercise_id)
        if model:
            self.session.delete(model)
            self.session.commit()

    def is_used_in_any_plan(self, exercise_id: int) -> bool:
        """Check if an exercise is used in any workout plan."""
        return (
            self.session.query(WorkoutExerciseModel)
            .filter_by(exercise_id=exercise_id)
            .first()
            is not None
        )

    def exists_by_user_and_name(self, user_id: int, name: str) -> bool:
        """Check if an exercise with the given name already exists for the user."""
        return (
            self.session.query(ExerciseModel)
            .filter_by(user_id=user_id, name=name)
            .first()
            is not None
        )

    def _model_to_entity(self, model: ExerciseModel) -> Exercise:
        """Convert a SQLAlchemy model to a domain entity."""
        return Exercise(
            id=model.id,
            user_id=model.user_id,
            name=model.name,
            created_at=model.created_at,
            muscle_group=model.muscle_group,
            equipment=model.equipment,
            video_url=model.video_url,
            logging_type=model.logging_type,
        )
