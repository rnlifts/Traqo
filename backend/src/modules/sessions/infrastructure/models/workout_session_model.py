from datetime import datetime

from sqlalchemy import Column, Integer, DateTime, ForeignKey

from src.infrastructure.database import Base

# Register the plan_shares table on Base.metadata whenever this model is imported —
# the share_id FK below can't resolve at create_all() time otherwise (e.g. in fresh
# test databases that never import the sharing module directly).
from src.modules.sharing.infrastructure.models.plan_share_model import PlanShareModel  # noqa: F401


class WorkoutSessionModel(Base):
    """SQLAlchemy model for workout_sessions table."""

    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workout_plan_id = Column(Integer, ForeignKey("workout_plans.id"), nullable=True)
    plan_day_id = Column(Integer, ForeignKey("plan_days.id"), nullable=True)
    plan_week_id = Column(Integer, ForeignKey("plan_weeks.id"), nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    # Share attribution (nullable, fixed at log time — see plan_shares migration).
    share_id = Column(Integer, ForeignKey("plan_shares.id", ondelete="SET NULL"), nullable=True)
    logged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    def to_domain(self):
        from ...domain.entities.workout_session import WorkoutSession

        return WorkoutSession(
            id=self.id,
            user_id=self.user_id,
            workout_plan_id=self.workout_plan_id,
            plan_day_id=self.plan_day_id,
            plan_week_id=self.plan_week_id,
            started_at=self.started_at,
            completed_at=self.completed_at,
            share_id=self.share_id,
            logged_by_user_id=self.logged_by_user_id,
        )
