from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from src.infrastructure.database import Base


class PlanWeekModel(Base):
    __tablename__ = "plan_weeks"

    id = Column(Integer, primary_key=True)
    workout_plan_id = Column(
        Integer, ForeignKey("workout_plans.id"), nullable=False
    )
    week_number = Column(Integer, nullable=False)
    mode = Column(String(10), nullable=False)  # 'base' | 'linked' | 'custom'
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_domain(self):
        from ...domain.entities.plan_week import PlanWeek

        return PlanWeek(
            id=self.id,
            workout_plan_id=self.workout_plan_id,
            week_number=self.week_number,
            mode=self.mode,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
