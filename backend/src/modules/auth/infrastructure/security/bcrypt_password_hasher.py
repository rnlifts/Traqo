import bcrypt

from ...domain.interfaces.password_hasher import PasswordHasher


class BcryptPasswordHasher(PasswordHasher):
    """Implements PasswordHasher using bcrypt directly."""

    def hash(self, password: str) -> str:
        """Hash a plaintext password."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def verify(self, password: str, password_hash: str) -> bool:
        """Verify a plaintext password against a hash."""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except (ValueError, TypeError):
            return False
