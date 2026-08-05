"""Use case: revoke a plan's share."""
from datetime import datetime

from ...domain.entities.plan_share import PlanShare
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ShareNotFoundError(Exception):
    """Raised when a plan has no share yet."""
    pass


class RevokeShare:
    """Soft-revoke a plan's share (set revoked_at = now)."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(self, workout_plan_id: int) -> PlanShare:
        """
        Soft-revoke the plan's share by setting revoked_at = now.

        Idempotent: revoking an already-revoked share is a no-op.
        Raises ShareNotFoundError if the plan has no share yet.
        """
        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            raise ShareNotFoundError(f"Plan {workout_plan_id} has no share yet")

        share.revoked_at = datetime.utcnow()
        return self.share_repo.update(share)
