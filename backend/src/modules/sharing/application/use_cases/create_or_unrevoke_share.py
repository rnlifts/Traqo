"""Use case: create or un-revoke a plan's share."""
from datetime import datetime

from ...domain.entities.plan_share import PlanShare, SHARE_MODE_RESTRICTED
from ...domain.interfaces.plan_share_repository import PlanShareRepository
from src.infrastructure.security.share_token_service import generate_share_token


class CreateOrUnrevokeShare:
    """Create a new share for a plan, or un-revoke an existing one."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(self, workout_plan_id: int) -> PlanShare:
        """
        Create or un-revoke a share for the plan.

        If a share already exists (even revoked), un-revoke it by setting revoked_at=None.
        Otherwise, create a new share with default mode='restricted', link_permission='view'.

        Returns the share with id, token, created_at set.
        """
        existing = self.share_repo.get_by_plan(workout_plan_id)

        if existing:
            # Un-revoke by clearing revoked_at
            existing.revoked_at = None
            return self.share_repo.update(existing)

        # Create new share with defaults
        token = generate_share_token()
        share = PlanShare(
            workout_plan_id=workout_plan_id,
            token=token,
            mode=SHARE_MODE_RESTRICTED,
            link_permission="view",
        )
        return self.share_repo.create(share)
