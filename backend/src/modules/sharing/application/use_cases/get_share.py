"""Use case: get a plan's share configuration + grants."""
from ...domain.entities.plan_share import PlanShare, PlanShareGrant
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ShareNotFoundError(Exception):
    """Raised when a plan has no share yet."""
    pass


class GetShare:
    """Fetch a plan's share config and its list of grants."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(self, workout_plan_id: int) -> tuple[PlanShare, list[PlanShareGrant]]:
        """
        Get the plan's share and its grants.

        Raises ShareNotFoundError if the plan has no share yet.
        Returns (share, grants_list).
        """
        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            raise ShareNotFoundError(f"Plan {workout_plan_id} has no share yet")

        grants = self.share_repo.list_grants(share.id)
        return share, grants
