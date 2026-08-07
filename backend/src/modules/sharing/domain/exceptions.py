"""Domain exceptions for the sharing feature."""


class ShareNotFoundError(Exception):
    """Raised when a share is not found, missing, or revoked (404)."""
    pass


class ShareAccessDeniedError(Exception):
    """Raised when a caller lacks permission to access a share (403)."""
    pass


class InvalidShareConfigurationError(Exception):
    """Raised when a requested share configuration is not allowed (422).

    Currently: mode='anyone' may only ever carry link_permission='view' — a public
    link must never grant log/edit to an anonymous or unrelated visitor. Named
    access above view (via a per-username grant) is unaffected by this rule.
    """
    pass
