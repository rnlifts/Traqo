from sqlalchemy.orm import Session

from ...domain.entities.workout_set import WorkoutSet
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from ..models.workout_set_model import WorkoutSetModel


class WorkoutSetRepositoryImpl(WorkoutSetRepository):
    """Implements WorkoutSetRepository against SQLAlchemy."""

    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def create(self, workout_set: WorkoutSet) -> WorkoutSet:
        """Create and persist a new workout set."""
        model = WorkoutSetModel(
            workout_session_id=workout_set.workout_session_id,
            exercise_id=workout_set.exercise_id,
            set_number=workout_set.set_number,
            weight=workout_set.weight,
            reps=workout_set.reps,
            notes=workout_set.notes,
        )
        self.session.add(model)
        self.session.commit()
        return model.to_domain()

    def list_by_session(self, session_id: int) -> list[WorkoutSet]:
        """Retrieve all sets logged in a given session."""
        models = (
            self.session.query(WorkoutSetModel)
            .filter_by(workout_session_id=session_id)
            .order_by(WorkoutSetModel.id)
            .all()
        )
        return [m.to_domain() for m in models]

    def count_by_session_and_exercise(self, session_id: int, exercise_id: int) -> int:
        """Count sets for a specific exercise in a session."""
        return (
            self.session.query(WorkoutSetModel)
            .filter_by(workout_session_id=session_id, exercise_id=exercise_id)
            .count()
        )
