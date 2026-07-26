from sqlalchemy.orm import Session

from ...domain.entities.plan_day import PlanDay
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ..models.plan_day_model import PlanDayModel


class PlanDayRepositoryImpl(PlanDayRepository):
    """SQLAlchemy implementation of PlanDayRepository."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, plan_day: PlanDay) -> PlanDay:
        """Create and persist a new plan day."""
        model = PlanDayModel(
            workout_plan_id=plan_day.workout_plan_id,
            label=plan_day.label,
            order_position=plan_day.order_position,
            is_rest=plan_day.is_rest,
            plan_week_id=plan_day.plan_week_id,
        )
        self.db.add(model)
        self.db.commit()
        return model.to_domain()

    def get_by_id(self, day_id: int) -> PlanDay | None:
        """Retrieve a plan day by id."""
        model = self.db.query(PlanDayModel).filter(PlanDayModel.id == day_id).first()
        return model.to_domain() if model else None

    def list_by_plan(self, plan_id: int) -> list[PlanDay]:
        """Get all days for a plan, ordered by order_position."""
        models = (
            self.db.query(PlanDayModel)
            .filter(PlanDayModel.workout_plan_id == plan_id)
            .order_by(PlanDayModel.order_position)
            .all()
        )
        return [m.to_domain() for m in models]

    def update(self, plan_day: PlanDay) -> PlanDay:
        """Update an existing plan day."""
        from datetime import datetime
        model = self.db.query(PlanDayModel).filter(PlanDayModel.id == plan_day.id).first()
        if model:
            model.label = plan_day.label
            model.order_position = plan_day.order_position
            model.is_rest = plan_day.is_rest
            model.plan_week_id = plan_day.plan_week_id
            model.updated_at = datetime.utcnow()  # Explicitly set to ensure the field is updated
            self.db.commit()
            return model.to_domain()
        return plan_day

    def delete(self, day_id: int) -> None:
        """Delete a plan day by id."""
        self.db.query(PlanDayModel).filter(PlanDayModel.id == day_id).delete()
        self.db.commit()
