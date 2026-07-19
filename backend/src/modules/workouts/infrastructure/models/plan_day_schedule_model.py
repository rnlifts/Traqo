from sqlalchemy import Column, Integer, String, ForeignKey

from src.infrastructure.database import Base


class PlanDayScheduleModel(Base):
    __tablename__ = "plan_day_schedule"

    id = Column(Integer, primary_key=True)
    plan_day_id = Column(
        Integer, ForeignKey("plan_days.id", ondelete="CASCADE"), nullable=False
    )
    weekday = Column(String(10), nullable=False)

    def to_domain(self):
        """Return just the weekday string for the domain layer."""
        return self.weekday
