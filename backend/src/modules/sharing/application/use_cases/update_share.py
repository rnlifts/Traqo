"""Use case: update a plan's share settings."""
from ...domain.entities.plan_share import PlanShare
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ShareNotFoundError(Exception):
    """Raised when a plan has no share yet."""
    pass


class UpdateShare:
    """Update a plan's share mode and/or link_permission."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(
        self,
        workout_plan_id: int,
        mode: str | None = None,
        link_permission: str | None = None,
    ) -> PlanShare:
        """
        Update the plan's share configuration.

        Only mode and/or link_permission are updated if provided.
        Raises ShareNotFoundError if the plan has no share yet.
        """
        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            raise ShareNotFoundError(f"Plan {workout_plan_id} has no share yet")

        if mode is not None:
            share.mode = mode
        if link_permission is not None:
            share.link_permission = link_permission

        return self.share_repo.update(share)
