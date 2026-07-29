from sqlalchemy.orm import Session

from ...domain.entities.workout_session import WorkoutSession
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ..models.workout_session_model import WorkoutSessionModel


class WorkoutSessionRepositoryImpl(WorkoutSessionRepository):
    """Implements WorkoutSessionRepository against SQLAlchemy."""

    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def create(self, session: WorkoutSession) -> WorkoutSession:
        """Create and persist a new workout session."""
        model = WorkoutSessionModel(
            user_id=session.user_id,
            workout_plan_id=session.workout_plan_id,
            plan_day_id=session.plan_day_id,
            plan_week_id=session.plan_week_id,
            started_at=session.started_at,
            completed_at=session.completed_at,
        )
        self.session.add(model)
        self.session.commit()
        return model.to_domain()

    def get_by_id(self, session_id: int) -> WorkoutSession | None:
        """Retrieve a workout session by id."""
        model = self.session.query(WorkoutSessionModel).get(session_id)
        return model.to_domain() if model else None

    def update(self, session: WorkoutSession) -> WorkoutSession:
        """Update an existing workout session."""
        model = self.session.query(WorkoutSessionModel).get(session.id)
        if not model:
            return None
        model.completed_at = session.completed_at
        self.session.commit()
        return model.to_domain()

    def list_finished_by_user(self, user_id: int) -> list[WorkoutSession]:
        """Retrieve all finished sessions for a user, ordered by started_at descending."""
        models = (
            self.session.query(WorkoutSessionModel)
            .filter_by(user_id=user_id)
            .filter(WorkoutSessionModel.completed_at.isnot(None))
            .order_by(WorkoutSessionModel.started_at.desc())
            .all()
        )
        return [m.to_domain() for m in models]

    def exists_for_plan(self, plan_id: int) -> bool:
        """Check if any sessions exist for a given plan."""
        return self.session.query(WorkoutSessionModel).filter_by(workout_plan_id=plan_id).first() is not None

    def exists_for_day(self, day_id: int) -> bool:
        """Check if any sessions exist for a given plan day."""
        return self.session.query(WorkoutSessionModel).filter_by(plan_day_id=day_id).first() is not None

    def get_most_recent_finished_for_day(
        self, day_id: int, exclude_session_id: int | None = None
    ) -> WorkoutSession | None:
        """Get the most recently started finished session for a given plan day."""
        query = (
            self.session.query(WorkoutSessionModel)
            .filter_by(plan_day_id=day_id)
            .filter(WorkoutSessionModel.completed_at.isnot(None))
        )

        if exclude_session_id is not None:
            query = query.filter(WorkoutSessionModel.id != exclude_session_id)

        model = query.order_by(WorkoutSessionModel.started_at.desc()).first()
        return model.to_domain() if model else None

    def find_unresolved_by_user(self, user_id: int) -> WorkoutSession | None:
        """Return the user's most recent session with completed_at IS NULL, or None."""
        model = (
            self.session.query(WorkoutSessionModel)
            .filter_by(user_id=user_id)
            .filter(WorkoutSessionModel.completed_at.is_(None))
            .order_by(WorkoutSessionModel.started_at.desc())
            .first()
        )
        return model.to_domain() if model else None

    def delete(self, session_id: int) -> None:
        """Permanently delete a session and (via DB cascade) its sets."""
        model = self.session.query(WorkoutSessionModel).get(session_id)
        if model:
            self.session.delete(model)
            self.session.commit()
