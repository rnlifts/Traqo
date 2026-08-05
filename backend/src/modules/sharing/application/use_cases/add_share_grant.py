"""Use case: add or update a grant on a plan's share."""
from ...domain.entities.plan_share import PlanShare, PlanShareGrant
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ShareNotFoundError(Exception):
    """Raised when a plan has no share yet."""
    pass


class UserNotFoundError(Exception):
    """Raised when a username is not found."""
    pass


class CannotGrantToSelfError(Exception):
    """Raised when attempting to grant to the plan owner."""
    pass


class AddShareGrant:
    """Add or update a user's grant on a plan's share."""

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(
        self,
        workout_plan_id: int,
        user_id: int,
        permission: str,
        owner_id: int,
    ) -> tuple[PlanShareGrant, str, str]:
        """
        Add or update a grant on the plan's share.

        Args:
            workout_plan_id: the plan being shared
            user_id: the user being granted
            permission: 'view', 'log', or 'edit'
            owner_id: the plan owner (to reject self-grants)

        Returns:
            Tuple of (grant, username, display_name) — the username and display_name
            are returned from the user entity passed in externally (in the route).

        Raises:
            ShareNotFoundError: if the plan has no share yet
            CannotGrantToSelfError: if user_id == owner_id
        """
        if user_id == owner_id:
            raise CannotGrantToSelfError("Cannot grant a share to the plan owner")

        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            raise ShareNotFoundError(f"Plan {workout_plan_id} has no share yet")

        grant = PlanShareGrant(
            plan_share_id=share.id,
            user_id=user_id,
            permission=permission,
        )
        return self.share_repo.add_grant(grant)
