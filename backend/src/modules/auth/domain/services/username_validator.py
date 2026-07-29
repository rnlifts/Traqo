import re


class UsernameValidator:
    """Validates username format: 3-20 chars, lowercase letters/digits/underscore, must start with letter."""

    MIN_LENGTH = 3
    MAX_LENGTH = 20
    PATTERN = r"^[a-z][a-z0-9_]{2,19}$"

    @staticmethod
    def normalize(username: str) -> str:
        """Normalize username to lowercase and strip whitespace."""
        return username.strip().lower()

    @staticmethod
    def validate_format(username: str) -> tuple[bool, str | None]:
        """
        Validate username format rules.
        Returns (is_valid, error_message_if_invalid).
        """
        normalized = UsernameValidator.normalize(username)

        if not normalized:
            return False, "Username cannot be empty."

        if len(normalized) < UsernameValidator.MIN_LENGTH:
            return False, f"Must be at least {UsernameValidator.MIN_LENGTH} characters."

        if len(normalized) > UsernameValidator.MAX_LENGTH:
            return False, f"Must be at most {UsernameValidator.MAX_LENGTH} characters."

        if not re.match(UsernameValidator.PATTERN, normalized):
            if not normalized[0].isalpha():
                return False, "Must start with a letter."
            return False, "Only lowercase letters, numbers, and underscores allowed."

        return True, None
