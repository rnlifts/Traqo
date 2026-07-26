import random
import re
from typing import Callable


class UsernameGenerator:
    """Generates unique usernames from display names (e.g., 'Aryan' → 'aryan_8392')."""

    def __init__(self, is_username_taken: Callable[[str], bool]):
        """
        Initialize with an injected uniqueness-check function.

        Args:
            is_username_taken: callable(username: str) -> bool
                Should return True if the username is already in use.
        """
        self.is_username_taken = is_username_taken

    def generate(self, display_name: str) -> str:
        """Generate a unique username from a display name."""
        # Sanitize: lowercase, remove non-alphanumeric (keep only letters, digits, underscore)
        base = display_name.lower().strip()
        base = re.sub(r"[^a-z0-9_]", "", base)

        # Always append random 4-digit suffix for uniqueness and predictability
        for _ in range(100):  # Avoid infinite loop
            suffix = random.randint(1000, 9999)
            candidate = f"{base}_{suffix}"
            if not self.is_username_taken(candidate):
                return candidate

        # Fallback (extremely unlikely to reach)
        raise RuntimeError(f"Could not generate unique username for '{display_name}'")
