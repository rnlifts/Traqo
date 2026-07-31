"""Unit tests for auth module."""

import pytest
from src.modules.auth.domain.entities.user import User
from src.modules.auth.domain.exceptions import InvalidCredentialsError, UsernameAlreadyTakenError
from src.modules.auth.domain.interfaces.user_repository import UserRepository
from src.modules.auth.domain.interfaces.password_hasher import PasswordHasher
from src.modules.auth.domain.services.username_validator import UsernameValidator
from src.modules.auth.application.use_cases.register_user import RegisterUser
from src.modules.auth.application.use_cases.login_user import LoginUser


# ============================================================================
# In-Memory Test Doubles
# ============================================================================


class InMemoryUserRepository(UserRepository):
    """In-memory implementation of UserRepository for testing."""

    def __init__(self):
        self.users = {}
        self.next_id = 1

    def get_by_username(self, username: str) -> User | None:
        for user in self.users.values():
            if user.username.lower() == username.lower():
                return user
        return None

    def save(self, user: User) -> User:
        if user.id is None:
            user.id = self.next_id
            self.next_id += 1
        self.users[user.id] = user
        return user

    def exists_by_username(self, username: str) -> bool:
        return self.get_by_username(username) is not None

    def record_failed_login(self, user: User) -> None:
        """Increment failed login attempts and set lockout if threshold reached."""
        from src.config.settings import settings
        from datetime import datetime, timedelta

        if user.id in self.users:
            self.users[user.id].failed_login_attempts += 1
            if self.users[user.id].failed_login_attempts >= settings.LOGIN_LOCKOUT_MAX_ATTEMPTS:
                self.users[user.id].locked_until = datetime.utcnow() + timedelta(
                    minutes=settings.LOGIN_LOCKOUT_DURATION_MINUTES
                )

    def reset_login_attempts(self, user: User) -> None:
        """Clear failed login attempts and lockout state on successful login."""
        if user.id in self.users:
            self.users[user.id].failed_login_attempts = 0
            self.users[user.id].locked_until = None


class MockPasswordHasher(PasswordHasher):
    """Mock password hasher for testing (no real hashing)."""

    def __init__(self):
        self.hashes = {}  # Map from plaintext to hash for testing

    def hash(self, password: str) -> str:
        # For testing, just prefix with "hash:"
        hash_value = f"hash:{password}"
        self.hashes[password] = hash_value
        return hash_value

    def verify(self, password: str, password_hash: str) -> bool:
        # For testing, verify by checking the hash format
        return password_hash == f"hash:{password}"


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def user_repo():
    """Provide an in-memory UserRepository."""
    return InMemoryUserRepository()


@pytest.fixture
def password_hasher():
    """Provide a mock PasswordHasher."""
    return MockPasswordHasher()


# ============================================================================
# RegisterUser Tests
# ============================================================================


class TestRegisterUser:
    """Tests for RegisterUser use case."""

    def test_register_with_valid_data(self, user_repo, password_hasher):
        """RegisterUser creates user with hashed password when given valid data."""
        use_case = RegisterUser(user_repo, password_hasher)

        user = use_case.execute("Alice Smith", "alice123", "SecurePass123!")

        assert user.id == 1
        assert user.username == "alice123"
        assert user.display_name == "Alice Smith"
        assert user.password_hash == "hash:SecurePass123!"

    def test_register_normalizes_username_to_lowercase(self, user_repo, password_hasher):
        """RegisterUser normalizes username to lowercase."""
        use_case = RegisterUser(user_repo, password_hasher)

        user = use_case.execute("Bob Johnson", "BobJohn", "password123")

        assert user.username == "bobjohn"

    def test_register_duplicate_username_raises_error(self, user_repo, password_hasher):
        """RegisterUser raises UsernameAlreadyTakenError when username is taken."""
        use_case = RegisterUser(user_repo, password_hasher)

        # Register first user
        use_case.execute("Alice", "alice123", "pass1")

        # Try to register with same username
        with pytest.raises(UsernameAlreadyTakenError):
            use_case.execute("Different Alice", "alice123", "pass2")

    def test_register_duplicate_username_case_insensitive(self, user_repo, password_hasher):
        """RegisterUser treats usernames case-insensitively."""
        use_case = RegisterUser(user_repo, password_hasher)

        use_case.execute("Alice", "alice123", "pass1")

        # Try with uppercase variation
        with pytest.raises(UsernameAlreadyTakenError):
            use_case.execute("Alice", "ALICE123", "pass2")

    def test_register_multiple_users(self, user_repo, password_hasher):
        """RegisterUser can register multiple users with different usernames."""
        use_case = RegisterUser(user_repo, password_hasher)

        user1 = use_case.execute("Alice", "alice123", "pass1")
        user2 = use_case.execute("Bob", "bob456", "pass2")

        assert user1.id == 1
        assert user2.id == 2
        assert user1.username != user2.username

    def test_register_returns_user_with_id(self, user_repo, password_hasher):
        """RegisterUser returns the created user with id set."""
        use_case = RegisterUser(user_repo, password_hasher)

        user = use_case.execute("Alice", "alice123", "password")

        assert user.id is not None
        assert isinstance(user.id, int)


# ============================================================================
# LoginUser Tests
# ============================================================================


class TestLoginUser:
    """Tests for LoginUser use case."""

    def test_login_with_valid_credentials(self, user_repo, password_hasher):
        """LoginUser returns user when credentials are valid."""
        # Setup: Create a user
        register = RegisterUser(user_repo, password_hasher)
        register.execute("Alice", "alice123", "correctpass")

        # Test login
        login = LoginUser(user_repo, password_hasher)
        user = login.execute("alice123", "correctpass")

        assert user.username == "alice123"
        assert user.display_name == "Alice"

    def test_login_with_wrong_password_raises_error(self, user_repo, password_hasher):
        """LoginUser raises InvalidCredentialsError when password is wrong."""
        register = RegisterUser(user_repo, password_hasher)
        register.execute("Alice", "alice123", "correctpass")

        login = LoginUser(user_repo, password_hasher)
        with pytest.raises(InvalidCredentialsError):
            login.execute("alice123", "wrongpass")

    def test_login_with_nonexistent_user_raises_error(self, user_repo, password_hasher):
        """LoginUser raises InvalidCredentialsError when user doesn't exist."""
        login = LoginUser(user_repo, password_hasher)

        with pytest.raises(InvalidCredentialsError):
            login.execute("nonexistent", "anypass")

    def test_login_normalizes_username(self, user_repo, password_hasher):
        """LoginUser works with uppercase username (case-insensitive)."""
        register = RegisterUser(user_repo, password_hasher)
        register.execute("Alice", "alice123", "correctpass")

        login = LoginUser(user_repo, password_hasher)
        # Try login with uppercase
        user = login.execute("ALICE123", "correctpass")
        assert user.username == "alice123"

    def test_login_empty_password_fails(self, user_repo, password_hasher):
        """LoginUser raises InvalidCredentialsError for empty password."""
        register = RegisterUser(user_repo, password_hasher)
        register.execute("Alice", "alice123", "mypass")

        login = LoginUser(user_repo, password_hasher)
        with pytest.raises(InvalidCredentialsError):
            login.execute("alice123", "")


# ============================================================================
# UsernameValidator Tests
# ============================================================================


class TestUsernameValidatorFormat:
    """Tests for UsernameValidator.validate_format()."""

    def test_valid_username(self):
        """Valid username passes validation."""
        is_valid, error = UsernameValidator.validate_format("alice123")
        assert is_valid is True
        assert error is None

    def test_valid_username_with_underscore(self):
        """Username with underscore passes validation."""
        is_valid, error = UsernameValidator.validate_format("alice_smith")
        assert is_valid is True
        assert error is None

    def test_username_too_short(self):
        """Username shorter than 3 chars fails validation."""
        is_valid, error = UsernameValidator.validate_format("ab")
        assert is_valid is False
        assert "at least 3" in error.lower()

    def test_username_too_long(self):
        """Username longer than 20 chars fails validation."""
        is_valid, error = UsernameValidator.validate_format("a" * 21)
        assert is_valid is False
        assert "at most 20" in error.lower()

    def test_username_starts_with_number(self):
        """Username starting with digit fails validation."""
        is_valid, error = UsernameValidator.validate_format("1alice")
        assert is_valid is False
        assert "must start with a letter" in error.lower()

    def test_username_starts_with_underscore(self):
        """Username starting with underscore fails validation."""
        is_valid, error = UsernameValidator.validate_format("_alice")
        assert is_valid is False
        assert "must start with a letter" in error.lower()

    def test_username_with_uppercase_is_normalized(self):
        """Username with uppercase letters is normalized then validated (passes if format OK)."""
        # validate_format normalizes input internally, so "Alice" becomes "alice" and passes
        is_valid, error = UsernameValidator.validate_format("Alice")
        assert is_valid is True
        assert error is None

    def test_username_with_special_chars(self):
        """Username with special characters fails validation."""
        is_valid, error = UsernameValidator.validate_format("alice-smith")
        assert is_valid is False
        assert "lowercase letters, numbers, and underscores" in error.lower()

    def test_username_with_space(self):
        """Username with space fails validation."""
        is_valid, error = UsernameValidator.validate_format("alice smith")
        assert is_valid is False

    def test_empty_username(self):
        """Empty username fails validation."""
        is_valid, error = UsernameValidator.validate_format("")
        assert is_valid is False
        assert "cannot be empty" in error.lower()

    def test_minimum_valid_length(self):
        """Username with exactly 3 chars passes validation."""
        is_valid, error = UsernameValidator.validate_format("abc")
        assert is_valid is True
        assert error is None

    def test_maximum_valid_length(self):
        """Username with exactly 20 chars passes validation."""
        is_valid, error = UsernameValidator.validate_format("a" + "b" * 18 + "c")
        assert is_valid is True
        assert error is None


class TestUsernameValidatorNormalize:
    """Tests for UsernameValidator.normalize()."""

    def test_normalize_uppercase_to_lowercase(self):
        """Normalize converts uppercase to lowercase."""
        result = UsernameValidator.normalize("ALICE123")
        assert result == "alice123"

    def test_normalize_mixed_case(self):
        """Normalize handles mixed case."""
        result = UsernameValidator.normalize("AlIcE123")
        assert result == "alice123"

    def test_normalize_strips_whitespace(self):
        """Normalize strips leading and trailing whitespace."""
        result = UsernameValidator.normalize("  alice123  ")
        assert result == "alice123"

    def test_normalize_no_change_needed(self):
        """Normalize returns unchanged if already normalized."""
        result = UsernameValidator.normalize("alice123")
        assert result == "alice123"
