"""Use case: update a user's profile fields (age, weight, height, gender, activity level)."""

from ...domain.entities.user import User
from ...domain.exceptions import InvalidProfileFieldError, UserNotFoundError
from ...domain.interfaces.user_repository import UserRepository
from ...domain.services.body_metrics import ACTIVITY_MULTIPLIERS

VALID_GENDERS = {"male", "female", "other"}


class UpdateUserProfile:
    """Use case: update a user's profile. Always receives canonical metric values —
    unit conversion (lbs/ft-in) happens on the frontend, never here."""

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def execute(
        self,
        user_id: int,
        age: int | None,
        weight_kg: float | None,
        height_cm: float | None,
        gender: str | None,
        activity_level: str | None,
    ) -> User:
        """
        Update a user's profile fields. Every field is independently optional —
        a caller may clear a field back to None, or leave others untouched by
        passing the user's current value for them (this use case always sets
        exactly what it's given, it does not merge with existing data).

        Raises:
            UserNotFoundError: If the user id doesn't resolve.
            InvalidProfileFieldError: If age/weight/height aren't positive, or
                gender/activity_level aren't one of the recognized values.
        """
        user = self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(f"User {user_id} not found")

        if age is not None and age <= 0:
            raise InvalidProfileFieldError("Age must be a positive number")
        if weight_kg is not None and weight_kg <= 0:
            raise InvalidProfileFieldError("Weight must be a positive number")
        if height_cm is not None and height_cm <= 0:
            raise InvalidProfileFieldError("Height must be a positive number")
        if gender is not None and gender not in VALID_GENDERS:
            raise InvalidProfileFieldError(f"Gender must be one of: {', '.join(sorted(VALID_GENDERS))}")
        if activity_level is not None and activity_level not in ACTIVITY_MULTIPLIERS:
            raise InvalidProfileFieldError(
                f"Activity level must be one of: {', '.join(ACTIVITY_MULTIPLIERS.keys())}"
            )

        user.age = age
        user.weight_kg = weight_kg
        user.height_cm = height_cm
        user.gender = gender
        user.activity_level = activity_level

        return self.user_repository.save(user)
