from sqlalchemy.orm import Session

from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.interfaces.workout_plan_repository import (
    WorkoutPlanRepository,
)
from src.modules.workouts.infrastructure.models.workout_plan_model import (
    WorkoutPlanModel,
)


class WorkoutPlanRepositoryImpl(WorkoutPlanRepository):
    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def create(self, plan: WorkoutPlan) -> WorkoutPlan:
        model = WorkoutPlanModel(
            user_id=plan.user_id,
            name=plan.name,
            unit_type=plan.unit_type,
            total_units=plan.total_units,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )
        self.session.add(model)
        self.session.commit()
        return model.to_domain()

    def list_by_user(self, user_id: int) -> list[WorkoutPlan]:
        models = self.session.query(WorkoutPlanModel).filter_by(user_id=user_id).all()
        return [m.to_domain() for m in models]

    def get_by_id(self, plan_id: int) -> WorkoutPlan | None:
        model = self.session.query(WorkoutPlanModel).get(plan_id)
        return model.to_domain() if model else None

    def update(self, plan: WorkoutPlan) -> WorkoutPlan:
        model = self.session.query(WorkoutPlanModel).get(plan.id)
        if not model:
            return None
        model.name = plan.name
        model.unit_type = plan.unit_type
        model.total_units = plan.total_units
        model.updated_at = plan.updated_at
        self.session.commit()
        return model.to_domain()

    def delete(self, plan_id: int) -> None:
        model = self.session.query(WorkoutPlanModel).get(plan_id)
        if model:
            self.session.delete(model)
            self.session.commit()
