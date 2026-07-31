from datetime import datetime

from ...domain.entities.user import User
from ...domain.exceptions import InvalidCredentialsError, AccountLockedError
from ...domain.interfaces.password_hasher import PasswordHasher
from ...domain.interfaces.user_repository import UserRepository


class LoginUser:
    """Use case: authenticate a user by username and password."""

    def __init__(self, user_repository: UserRepository, password_hasher: PasswordHasher):
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    def execute(self, username: str, password: str) -> User:
        """
        Authenticate a user.

        Args:
            username: user's username
            password: plaintext password

        Returns:
            The authenticated User entity

        Raises:
            InvalidCredentialsError: if username not found or password is wrong
            AccountLockedError: if account is locked due to too many failed attempts
        """
        user = self.user_repository.get_by_username(username)
        if not user:
            raise InvalidCredentialsError("Invalid username or password")

        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.utcnow():
            raise AccountLockedError("Account is locked due to too many failed login attempts")

        # Verify password
        if not self.password_hasher.verify(password, user.password_hash):
            self.user_repository.record_failed_login(user)
            raise InvalidCredentialsError("Invalid username or password")

        # Successful login: reset failed attempts
        self.user_repository.reset_login_attempts(user)
        return user
