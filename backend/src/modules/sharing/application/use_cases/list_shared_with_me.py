"""Use case: list all plans shared with a given user (the 'Shared with me' list)."""
from ...domain.entities.plan_share import PlanShare, PlanShareGrant
from ...domain.interfaces.plan_share_repository import PlanShareRepository


class ListSharedWithMe:
    """List every plan a user has been personally granted access to.

    Grant-based, not mode-based: a grant counts regardless of whether the parent
    share's overall mode is 'restricted' or 'anyone'. Revoked shares are excluded
    by the repository query this delegates to.
    """

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(self, user_id: int) -> list[tuple[PlanShareGrant, PlanShare]]:
        """Return (grant, share) pairs for every active grant this user holds."""
        return self.share_repo.list_active_grants_for_user(user_id)
