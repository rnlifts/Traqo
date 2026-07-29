class AuthException(Exception):
    """Base exception for auth domain."""

    pass


class InvalidCredentialsError(AuthException):
    """Raised when login credentials are invalid."""

    pass


class UsernameAlreadyTakenError(AuthException):
    """Raised when a username is already taken."""

    pass
