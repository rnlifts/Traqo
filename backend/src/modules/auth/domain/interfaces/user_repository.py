from abc import ABC, abstractmethod

from ..entities.user import User


class UserRepository(ABC):
    """Interface for user persistence."""

    @abstractmethod
    def get_by_username(self, username: str) -> User | None:
        """Retrieve a user by username. Returns None if not found."""
        pass

    @abstractmethod
    def save(self, user: User) -> User:
        """Persist a user. Returns the saved user (with id set if new)."""
        pass

    @abstractmethod
    def exists_by_username(self, username: str) -> bool:
        """Check if a username already exists."""
        pass
