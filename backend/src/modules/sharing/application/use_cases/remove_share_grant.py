"""Use case: remove a grant from a plan's share."""
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ShareNotFoundError(Exception):
    """Raised when a plan has no share yet."""
    pass


class RemoveShareGrant:
    """Remove a user's grant from a plan's share."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(self, workout_plan_id: int, user_id: int) -> None:
        """
        Remove a user's grant from the plan's share.

        No-op if the grant doesn't exist. No-op if the plan has no share.

        Args:
            workout_plan_id: the plan being shared
            user_id: the user whose grant to remove
        """
        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            # No share means no grants to remove
            return

        self.share_repo.remove_grant(share.id, user_id)
