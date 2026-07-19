from sqlalchemy.orm import Session

from ...domain.entities.plan_week import PlanWeek
from ...domain.interfaces.plan_week_repository import PlanWeekRepository
from ..models.plan_week_model import PlanWeekModel


class PlanWeekRepositoryImpl(PlanWeekRepository):
    """SQLAlchemy implementation of PlanWeekRepository."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, plan_week: PlanWeek) -> PlanWeek:
        """Create and persist a new plan week."""
        model = PlanWeekModel(
            workout_plan_id=plan_week.workout_plan_id,
            week_number=plan_week.week_number,
            mode=plan_week.mode,
        )
        self.db.add(model)
        self.db.commit()
        return model.to_domain()

    def get_by_id(self, week_id: int) -> PlanWeek | None:
        """Retrieve a plan week by id."""
        model = self.db.query(PlanWeekModel).filter(PlanWeekModel.id == week_id).first()
        return model.to_domain() if model else None

    def list_by_plan(self, plan_id: int) -> list[PlanWeek]:
        """Get all weeks for a plan, ordered by week_number."""
        models = (
            self.db.query(PlanWeekModel)
            .filter(PlanWeekModel.workout_plan_id == plan_id)
            .order_by(PlanWeekModel.week_number)
            .all()
        )
        return [m.to_domain() for m in models]

    def update(self, plan_week: PlanWeek) -> PlanWeek:
        """Update an existing plan week."""
        model = self.db.query(PlanWeekModel).filter(PlanWeekModel.id == plan_week.id).first()
        if model:
            model.mode = plan_week.mode
            self.db.commit()
            return model.to_domain()
        return plan_week

    def delete(self, week_id: int) -> None:
        """Delete a plan week by id."""
        self.db.query(PlanWeekModel).filter(PlanWeekModel.id == week_id).delete()
        self.db.commit()

    def get_by_plan_and_week_number(self, plan_id: int, week_number: int) -> PlanWeek | None:
        """Retrieve a plan week by plan_id and week_number."""
        model = (
            self.db.query(PlanWeekModel)
            .filter(
                PlanWeekModel.workout_plan_id == plan_id,
                PlanWeekModel.week_number == week_number,
            )
            .first()
        )
        return model.to_domain() if model else None
