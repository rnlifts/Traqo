"""Use case: update a plan's share settings."""
from ...domain.entities.plan_share import PlanShare, SHARE_MODE_ANYONE
from ...domain.interfaces.plan_share_repository import PlanShareRepository
from ...domain.exceptions import ShareNotFoundError, InvalidShareConfigurationError


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

        Raises:
            ShareNotFoundError: If the plan has no share yet.
            InvalidShareConfigurationError: If the resulting configuration would
                be mode='anyone' with link_permission other than 'view' — a public
                link may only ever grant view access; log/edit access requires a
                per-username grant to a specific, authenticated person.
        """
        share = self.share_repo.get_by_plan(workout_plan_id)
        if not share:
            raise ShareNotFoundError(f"Plan {workout_plan_id} has no share yet")

        # Validate the resulting state as a whole - a caller may only be changing
        # one of the two fields while the other is already set from a prior call,
        # so the check has to consider what the combination will be after this
        # update, not just the field(s) present in this particular request.
        resulting_mode = mode if mode is not None else share.mode
        resulting_link_permission = (
            link_permission if link_permission is not None else share.link_permission
        )
        if resulting_mode == SHARE_MODE_ANYONE and resulting_link_permission != "view":
            raise InvalidShareConfigurationError(
                "A public 'anyone' link may only grant 'view' access. "
                "Grant a specific username 'log' or 'edit' access instead."
            )

        if mode is not None:
            share.mode = mode
        if link_permission is not None:
            share.link_permission = link_permission

        return self.share_repo.update(share)
