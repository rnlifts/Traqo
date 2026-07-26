from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean

from src.infrastructure.database import Base


class WorkoutPlanModel(Base):
    __tablename__ = "workout_plans"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    unit_type = Column(String(10), nullable=True)  # 'days' | 'weeks'
    total_units = Column(Integer, nullable=True)
    is_quick_start = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_domain(self):
        from ...domain.entities.workout_plan import WorkoutPlan

        return WorkoutPlan(
            id=self.id,
            user_id=self.user_id,
            name=self.name,
            unit_type=self.unit_type,
            total_units=self.total_units,
            is_quick_start=self.is_quick_start,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
