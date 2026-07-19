from abc import ABC, abstractmethod


class PasswordHasher(ABC):
    """Interface for password hashing and verification."""

    @abstractmethod
    def hash(self, password: str) -> str:
        """Hash a plaintext password. Returns the hash."""
        pass

    @abstractmethod
    def verify(self, password: str, password_hash: str) -> bool:
        """Verify a plaintext password against a hash. Returns True if valid."""
        pass
