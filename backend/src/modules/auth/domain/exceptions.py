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

    def __init__(self, message: str, retry_after_seconds: int = 0):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class UserNotFoundError(AuthException):
    """Raised when a user id from an authenticated request no longer resolves to a user."""

    pass


class InvalidProfileFieldError(AuthException):
    """Raised when a profile field value (gender, activity_level, weight, height, age) is invalid."""

    pass
