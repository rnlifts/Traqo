from sqlalchemy.orm import Session

from ...domain.entities.plan_day import PlanDay
from ...domain.interfaces.plan_day_repository import PlanDayRepository
from ..models.plan_day_model import PlanDayModel
from ..models.plan_day_schedule_model import PlanDayScheduleModel


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
        model = self.db.query(PlanDayModel).filter(PlanDayModel.id == plan_day.id).first()
        if model:
            model.label = plan_day.label
            model.order_position = plan_day.order_position
            model.is_rest = plan_day.is_rest
            model.plan_week_id = plan_day.plan_week_id
            self.db.commit()
            return model.to_domain()
        return plan_day

    def delete(self, day_id: int) -> None:
        """Delete a plan day by id (cascades to weekday assignments)."""
        # Weekdays will cascade delete via FK if configured
        self.db.query(PlanDayModel).filter(PlanDayModel.id == day_id).delete()
        self.db.commit()

    def get_weekdays_for_day(self, day_id: int) -> list[str]:
        """Get list of weekdays assigned to a plan day."""
        schedules = (
            self.db.query(PlanDayScheduleModel)
            .filter(PlanDayScheduleModel.plan_day_id == day_id)
            .all()
        )
        return [s.weekday for s in schedules]

    def add_weekday(self, day_id: int, weekday: str) -> None:
        """Add a weekday to a plan day."""
        schedule = PlanDayScheduleModel(plan_day_id=day_id, weekday=weekday)
        self.db.add(schedule)
        self.db.commit()

    def remove_weekday(self, day_id: int, weekday: str) -> None:
        """Remove a weekday from a plan day."""
        self.db.query(PlanDayScheduleModel).filter(
            PlanDayScheduleModel.plan_day_id == day_id,
            PlanDayScheduleModel.weekday == weekday,
        ).delete()
        self.db.commit()

    def clear_weekdays(self, day_id: int) -> None:
        """Remove all weekdays from a plan day."""
        self.db.query(PlanDayScheduleModel).filter(
            PlanDayScheduleModel.plan_day_id == day_id
        ).delete()
        self.db.commit()

    def get_days_by_weekday_in_plan(self, plan_id: int, weekday: str) -> list[PlanDay]:
        """Get all days in a plan that are tagged to a specific weekday."""
        models = (
            self.db.query(PlanDayModel)
            .join(
                PlanDayScheduleModel,
                PlanDayModel.id == PlanDayScheduleModel.plan_day_id
            )
            .filter(
                PlanDayModel.workout_plan_id == plan_id,
                PlanDayScheduleModel.weekday == weekday
            )
            .order_by(PlanDayModel.order_position)
            .all()
        )
        return [m.to_domain() for m in models]
