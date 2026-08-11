from datetime import datetime


class User:
    """A user account in Traqo."""

    def __init__(
        self,
        username: str,
        display_name: str,
        password_hash: str,
        id: int | None = None,
        created_at: datetime | None = None,
        failed_login_attempts: int = 0,
        locked_until: datetime | None = None,
        age: int | None = None,
        weight_kg: float | None = None,
        height_cm: float | None = None,
        gender: str | None = None,
        activity_level: str | None = None,
    ):
        self.id = id
        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.created_at = created_at or datetime.utcnow()
        self.failed_login_attempts = failed_login_attempts
        self.locked_until = locked_until
        # Profile fields — always stored in canonical metric units (kg/cm); the
        # frontend converts to lbs/ft-in for display/input, backend never guesses units.
        self.age = age
        self.weight_kg = weight_kg
        self.height_cm = height_cm
        self.gender = gender
        self.activity_level = activity_level

    def has_complete_profile(self) -> bool:
        """Whether enough profile data exists to compute BMI/BMR/maintenance calories."""
        return all(
            v is not None
            for v in (self.age, self.weight_kg, self.height_cm, self.gender, self.activity_level)
        )
