from datetime import datetime

# Permission tiers, ordered weakest to strongest: view < log < edit.
# "view" sees the plan, "log" can start/log a workout from it, "edit" can modify it.
PERMISSION_ORDER = ["view", "log", "edit"]

SHARE_MODE_RESTRICTED = "restricted"  # only granted usernames can use the link
SHARE_MODE_ANYONE = "anyone"  # anyone with the link, no login required


def permission_at_least(actual: str, required: str) -> bool:
    """True if `actual` grants at least the `required` tier."""
    try:
        return PERMISSION_ORDER.index(actual) >= PERMISSION_ORDER.index(required)
    except ValueError:
        return False


class PlanShare:
    """A plan's share configuration: one opaque link token plus a mode.

    Revocation is soft (revoked_at) — a revoked share stops granting access but the
    row survives, so workout_sessions.share_id written at log time never dangles and
    is never retroactively changed.
    """

    def __init__(
        self,
        workout_plan_id: int,
        token: str,
        mode: str = SHARE_MODE_RESTRICTED,
        link_permission: str = "view",
        id: int | None = None,
        created_at: datetime | None = None,
        revoked_at: datetime | None = None,
    ):
        self.id = id
        self.workout_plan_id = workout_plan_id
        self.token = token
        self.mode = mode
        self.link_permission = link_permission
        self.created_at = created_at or datetime.utcnow()
        self.revoked_at = revoked_at

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class PlanShareGrant:
    """An ACL entry: a specific user granted a permission tier on a share."""

    def __init__(
        self,
        plan_share_id: int,
        user_id: int,
        permission: str = "view",
        id: int | None = None,
        created_at: datetime | None = None,
    ):
        self.id = id
        self.plan_share_id = plan_share_id
        self.user_id = user_id
        self.permission = permission
        self.created_at = created_at or datetime.utcnow()
