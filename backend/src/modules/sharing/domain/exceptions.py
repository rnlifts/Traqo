"""Domain exceptions for the sharing feature."""


class ShareNotFoundError(Exception):
    """Raised when a share is not found, missing, or revoked (404)."""
    pass


class ShareAccessDeniedError(Exception):
    """Raised when a caller lacks permission to access a share (403)."""
    pass
