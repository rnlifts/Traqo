from ...domain.entities.user import User
from ...domain.exceptions import InvalidCredentialsError
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
        """
        user = self.user_repository.get_by_username(username)
        if not user:
            raise InvalidCredentialsError("Invalid username or password")

        if not self.password_hasher.verify(password, user.password_hash):
            raise InvalidCredentialsError("Invalid username or password")

        return user
