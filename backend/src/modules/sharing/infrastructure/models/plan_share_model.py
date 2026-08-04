from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint

from src.infrastructure.database import Base


class PlanShareModel(Base):
    __tablename__ = "plan_shares"

    id = Column(Integer, primary_key=True)
    # CASCADE: a share is meaningless without its plan. Session history already
    # survives plan deletion via SET NULL on workout_sessions.share_id below.
    workout_plan_id = Column(
        Integer,
        ForeignKey("workout_plans.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    token = Column(String(64), nullable=False, unique=True, index=True)
    mode = Column(String(20), nullable=False, default="restricted")
    link_permission = Column(String(10), nullable=False, default="view")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    def to_domain(self):
        from ...domain.entities.plan_share import PlanShare

        return PlanShare(
            id=self.id,
            workout_plan_id=self.workout_plan_id,
            token=self.token,
            mode=self.mode,
            link_permission=self.link_permission,
            created_at=self.created_at,
            revoked_at=self.revoked_at,
        )


class PlanShareGrantModel(Base):
    __tablename__ = "plan_share_grants"
    __table_args__ = (
        UniqueConstraint("plan_share_id", "user_id", name="uq_plan_share_grants_share_user"),
    )

    id = Column(Integer, primary_key=True)
    plan_share_id = Column(
        Integer,
        ForeignKey("plan_shares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission = Column(String(10), nullable=False, default="view")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def to_domain(self):
        from ...domain.entities.plan_share import PlanShareGrant

        return PlanShareGrant(
            id=self.id,
            plan_share_id=self.plan_share_id,
            user_id=self.user_id,
            permission=self.permission,
            created_at=self.created_at,
        )
