class AuthException(Exception):
    """Base exception for auth domain."""

    pass


class InvalidCredentialsError(AuthException):
    """Raised when login credentials are invalid."""

    pass


class UsernameAlreadyTakenError(AuthException):
    """Raised when a username is already taken."""

    pass


class AccountLockedError(AuthException):
    """Raised when an account is locked due to too many failed login attempts."""

    pass


class UserNotFoundError(AuthException):
    """Raised when a user id from an authenticated request no longer resolves to a user."""

    pass


class InvalidProfileFieldError(AuthException):
    """Raised when a profile field value (gender, activity_level, weight, height, age) is invalid."""

    pass
