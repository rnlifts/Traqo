"""Use case: resolve access to a shared plan (Phase 3)."""
from ...domain.entities.plan_share import (
    PlanShare,
    permission_at_least,
    SHARE_MODE_ANYONE,
    SHARE_MODE_RESTRICTED,
)
from ...domain.interfaces.plan_share_repository import PlanShareRepository
from ...domain.exceptions import ShareNotFoundError, ShareAccessDeniedError


class ResolveShareAccess:
    """Resolve a caller's effective permission to access a shared plan.

    Algorithm:
    1. Look up share by token. Missing or revoked → raise ShareNotFoundError (404).
    2. Determine effective permission:
       - Owner (caller_user_id == plan_owner_user_id) → 'edit'
       - mode='anyone' → link_permission (for any caller)
         - If caller is authenticated and has a grant, use stronger of link_permission and grant
       - mode='restricted' → caller must be authenticated AND have a grant
         - If anonymous or no grant → raise ShareNotFoundError (403 in endpoint)
    3. Return (share, effective_permission).
    """

    def __init__(self, share_repo: PlanShareRepository):
        self.share_repo = share_repo

    def execute(
        self, token: str, caller_user_id: int | None, plan_owner_user_id: int
    ) -> tuple[PlanShare, str]:
        """
        Resolve access to a shared plan.

        Args:
            token: The share token.
            caller_user_id: The ID of the user accessing the plan, or None if anonymous.
            plan_owner_user_id: The ID of the plan's owner.

        Returns:
            (share, effective_permission)
            effective_permission is one of 'view', 'log', 'edit'.

        Raises:
            ShareNotFoundError: If share is missing/revoked or access is denied.
        """
        # Look up share by token
        share = self.share_repo.get_by_token(token)
        if not share or not share.is_active:
            raise ShareNotFoundError(f"Share token {token} not found or revoked")

        # Owner always has edit access
        if caller_user_id is not None and caller_user_id == plan_owner_user_id:
            return share, "edit"

        # For non-owners, determine effective permission based on mode
        if share.mode == SHARE_MODE_ANYONE:
            # Start with link_permission for anyone
            effective_permission = share.link_permission

            # If caller is authenticated, check if they have a grant and use stronger tier
            if caller_user_id is not None:
                grant = self.share_repo.get_grant_for_user(share.id, caller_user_id)
                if grant:
                    # Use the stronger of link_permission and grant.permission
                    if permission_at_least(grant.permission, effective_permission):
                        effective_permission = grant.permission

            return share, effective_permission

        elif share.mode == SHARE_MODE_RESTRICTED:
            # Restricted mode: must be authenticated and have a grant
            if caller_user_id is None:
                # Anonymous caller on restricted share → access denied (403)
                raise ShareAccessDeniedError(f"Share token {token}: anonymous access not allowed")

            grant = self.share_repo.get_grant_for_user(share.id, caller_user_id)
            if not grant:
                # Authenticated but no grant → access denied (403)
                raise ShareAccessDeniedError(f"Share token {token}: no grant for user")

            return share, grant.permission

        else:
            # Unknown mode (shouldn't happen)
            raise ShareNotFoundError(f"Share token {token}: invalid mode")
