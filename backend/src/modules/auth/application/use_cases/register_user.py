from ...domain.entities.user import User
from ...domain.exceptions import UsernameAlreadyTakenError
from ...domain.interfaces.password_hasher import PasswordHasher
from ...domain.interfaces.user_repository import UserRepository
from ...domain.services.username_validator import UsernameValidator


class RegisterUser:
    """Use case: register a new user account."""

    def __init__(self, user_repository: UserRepository, password_hasher: PasswordHasher):
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    def execute(self, display_name: str, username: str, password: str) -> User:
        """
        Register a new user.

        Args:
            display_name: user's display name (nickname)
            username: user's chosen username
            password: plaintext password

        Returns:
            The created User entity (with id and username set)

        Raises:
            UsernameAlreadyTakenError: if the username is already taken
        """
        # Normalize username (lowercase)
        normalized_username = UsernameValidator.normalize(username)

        # Check if username is already taken (race condition: must check at registration time too)
        if self.user_repository.exists_by_username(normalized_username):
            raise UsernameAlreadyTakenError()

        # Hash the password
        password_hash = self.password_hasher.hash(password)

        # Create and persist the user
        user = User(
            username=normalized_username,
            display_name=display_name,
            password_hash=password_hash,
        )
        return self.user_repository.save(user)
