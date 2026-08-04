from abc import ABC, abstractmethod

from ..entities.plan_share import PlanShare, PlanShareGrant


class PlanShareRepository(ABC):
    """Repository interface for plan shares and their per-user grants."""

    @abstractmethod
    def create(self, share: PlanShare) -> PlanShare:
        """Persist a new share and return it with its id set."""

    @abstractmethod
    def get_by_plan(self, workout_plan_id: int) -> PlanShare | None:
        """Return the plan's share config (one per plan), revoked or not."""

    @abstractmethod
    def get_by_token(self, token: str) -> PlanShare | None:
        """Look up a share by its opaque link token."""

    @abstractmethod
    def update(self, share: PlanShare) -> PlanShare:
        """Persist mode/link_permission/revoked_at changes."""

    @abstractmethod
    def add_grant(self, grant: PlanShareGrant) -> PlanShareGrant:
        """Add (or update, if the user already has one) a user's grant on a share."""

    @abstractmethod
    def list_grants(self, plan_share_id: int) -> list[PlanShareGrant]:
        """All grants on a share."""

    @abstractmethod
    def get_grant_for_user(self, plan_share_id: int, user_id: int) -> PlanShareGrant | None:
        """A specific user's grant on a share, if any."""

    @abstractmethod
    def remove_grant(self, plan_share_id: int, user_id: int) -> None:
        """Remove a user's grant. No-op if absent."""
