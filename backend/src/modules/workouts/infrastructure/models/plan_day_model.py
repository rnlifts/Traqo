from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean

from src.infrastructure.database import Base


class PlanDayModel(Base):
    __tablename__ = "plan_days"

    id = Column(Integer, primary_key=True)
    workout_plan_id = Column(
        Integer, ForeignKey("workout_plans.id"), nullable=False
    )
    label = Column(String(255), nullable=False)
    order_position = Column(Integer, nullable=False)
    is_rest = Column(Boolean, nullable=False, default=False)
    plan_week_id = Column(Integer, ForeignKey("plan_weeks.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_domain(self):
        from ...domain.entities.plan_day import PlanDay

        return PlanDay(
            id=self.id,
            workout_plan_id=self.workout_plan_id,
            label=self.label,
            order_position=self.order_position,
            is_rest=self.is_rest,
            plan_week_id=self.plan_week_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
