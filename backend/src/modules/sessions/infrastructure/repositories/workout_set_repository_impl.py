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
        result = model.to_domain()
        return result

    def get_by_id(self, set_id: int) -> WorkoutSet | None:
        """Retrieve a workout set by its id."""
        model = self.session.query(WorkoutSetModel).filter_by(id=set_id).first()
        return model.to_domain() if model else None

    def get_by_session_exercise_and_set_number(
        self, session_id: int, exercise_id: int, set_number: int
    ) -> WorkoutSet | None:
        """Retrieve a workout set by session, exercise, and set number."""
        from sqlalchemy import and_

        model = (
            self.session.query(WorkoutSetModel)
            .filter(
                and_(
                    WorkoutSetModel.workout_session_id == session_id,
                    WorkoutSetModel.exercise_id == exercise_id,
                    WorkoutSetModel.set_number == set_number,
                )
            )
            .first()
        )
        return model.to_domain() if model else None

    def update(self, workout_set: WorkoutSet) -> WorkoutSet:
        """Update an existing workout set."""
        model = self.session.query(WorkoutSetModel).filter_by(id=workout_set.id).first()
        if not model:
            raise ValueError(f"WorkoutSet with id {workout_set.id} not found")
        model.weight = workout_set.weight
        model.reps = workout_set.reps
        model.notes = workout_set.notes
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

    def delete(self, set_id: int) -> None:
        """Delete a workout set by its id."""
        self.session.query(WorkoutSetModel).filter_by(id=set_id).delete()
        self.session.commit()

    def list_finished_by_user_and_exercise(
        self, user_id: int, exercise_id: int
    ) -> list[WorkoutSet]:
        """Retrieve all finished sets for a user and exercise, ordered chronologically."""
        from ..models.workout_session_model import WorkoutSessionModel
        from sqlalchemy import and_

        models = (
            self.session.query(WorkoutSetModel)
            .join(
                WorkoutSessionModel,
                WorkoutSetModel.workout_session_id == WorkoutSessionModel.id,
            )
            .filter(
                and_(
                    WorkoutSessionModel.user_id == user_id,
                    WorkoutSessionModel.completed_at.isnot(None),
                    WorkoutSetModel.exercise_id == exercise_id,
                )
            )
            .order_by(WorkoutSessionModel.started_at.asc(), WorkoutSetModel.set_number.asc())
            .all()
        )
        return [m.to_domain() for m in models]
