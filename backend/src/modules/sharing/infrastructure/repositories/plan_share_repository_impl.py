from sqlalchemy.orm import Session

from ...domain.entities.plan_share import PlanShare, PlanShareGrant
from ...domain.interfaces.plan_share_repository import PlanShareRepository
from ..models.plan_share_model import PlanShareModel, PlanShareGrantModel


class PlanShareRepositoryImpl(PlanShareRepository):
    def __init__(self, session: Session):
        self.session = session

    def create(self, share: PlanShare) -> PlanShare:
        model = PlanShareModel(
            workout_plan_id=share.workout_plan_id,
            token=share.token,
            mode=share.mode,
            link_permission=share.link_permission,
            created_at=share.created_at,
            revoked_at=share.revoked_at,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model.to_domain()

    def get_by_plan(self, workout_plan_id: int) -> PlanShare | None:
        model = (
            self.session.query(PlanShareModel)
            .filter(PlanShareModel.workout_plan_id == workout_plan_id)
            .first()
        )
        return model.to_domain() if model else None

    def get_by_token(self, token: str) -> PlanShare | None:
        model = (
            self.session.query(PlanShareModel)
            .filter(PlanShareModel.token == token)
            .first()
        )
        return model.to_domain() if model else None

    def update(self, share: PlanShare) -> PlanShare:
        model = self.session.get(PlanShareModel, share.id)
        if model is None:
            raise ValueError(f"PlanShare {share.id} not found")
        model.mode = share.mode
        model.link_permission = share.link_permission
        model.revoked_at = share.revoked_at
        self.session.commit()
        self.session.refresh(model)
        return model.to_domain()

    def add_grant(self, grant: PlanShareGrant) -> PlanShareGrant:
        existing = (
            self.session.query(PlanShareGrantModel)
            .filter(
                PlanShareGrantModel.plan_share_id == grant.plan_share_id,
                PlanShareGrantModel.user_id == grant.user_id,
            )
            .first()
        )
        if existing:
            existing.permission = grant.permission
            self.session.commit()
            self.session.refresh(existing)
            return existing.to_domain()

        model = PlanShareGrantModel(
            plan_share_id=grant.plan_share_id,
            user_id=grant.user_id,
            permission=grant.permission,
            created_at=grant.created_at,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return model.to_domain()

    def list_grants(self, plan_share_id: int) -> list[PlanShareGrant]:
        models = (
            self.session.query(PlanShareGrantModel)
            .filter(PlanShareGrantModel.plan_share_id == plan_share_id)
            .order_by(PlanShareGrantModel.created_at)
            .all()
        )
        return [m.to_domain() for m in models]

    def get_grant_for_user(self, plan_share_id: int, user_id: int) -> PlanShareGrant | None:
        model = (
            self.session.query(PlanShareGrantModel)
            .filter(
                PlanShareGrantModel.plan_share_id == plan_share_id,
                PlanShareGrantModel.user_id == user_id,
            )
            .first()
        )
        return model.to_domain() if model else None

    def remove_grant(self, plan_share_id: int, user_id: int) -> None:
        (
            self.session.query(PlanShareGrantModel)
            .filter(
                PlanShareGrantModel.plan_share_id == plan_share_id,
                PlanShareGrantModel.user_id == user_id,
            )
            .delete()
        )
        self.session.commit()
