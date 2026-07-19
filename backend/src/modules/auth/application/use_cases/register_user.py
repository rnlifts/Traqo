from ...domain.entities.user import User
from ...domain.interfaces.password_hasher import PasswordHasher
from ...domain.interfaces.user_repository import UserRepository
from ...domain.services.username_generator import UsernameGenerator


class RegisterUser:
    """Use case: register a new user account."""

    def __init__(self, user_repository: UserRepository, password_hasher: PasswordHasher):
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    def execute(self, display_name: str, password: str) -> User:
        """
        Register a new user.

        Args:
            display_name: user's display name
            password: plaintext password

        Returns:
            The created User entity (with id and generated username set)
        """
        # Create username generator with real repository as the uniqueness check
        username_generator = UsernameGenerator(
            is_username_taken=self.user_repository.exists_by_username
        )
        username = username_generator.generate(display_name)

        # Hash the password
        password_hash = self.password_hasher.hash(password)

        # Create and persist the user
        user = User(
            username=username,
            display_name=display_name,
            password_hash=password_hash,
        )
        return self.user_repository.save(user)
