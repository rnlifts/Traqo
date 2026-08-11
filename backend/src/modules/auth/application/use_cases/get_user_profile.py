"""Use case: fetch a user's profile, with computed body metrics if it's complete."""

from dataclasses import dataclass

from ...domain.entities.user import User
from ...domain.exceptions import UserNotFoundError
from ...domain.interfaces.user_repository import UserRepository
from ...domain.services.body_metrics import BodyMetrics, calculate_body_metrics


@dataclass
class UserProfileResult:
    user: User
    is_complete: bool
    body_metrics: BodyMetrics | None  # None until the profile has every field


class GetUserProfile:
    """Use case: retrieve a user's profile plus computed BMI/BMR/maintenance calories."""

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def execute(self, user_id: int) -> UserProfileResult:
        """
        Get a user's profile.

        Args:
            user_id: The authenticated user's id.

        Returns:
            UserProfileResult — body_metrics is None whenever the profile is
            incomplete (never an error; an incomplete profile is a normal state).

        Raises:
            UserNotFoundError: If the user id doesn't resolve (shouldn't normally
                happen for an authenticated request, but defensive).
        """
        user = self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(f"User {user_id} not found")

        is_complete = user.has_complete_profile()
        body_metrics = (
            calculate_body_metrics(
                weight_kg=user.weight_kg,
                height_cm=user.height_cm,
                age=user.age,
                gender=user.gender,
                activity_level=user.activity_level,
            )
            if is_complete
            else None
        )

        return UserProfileResult(user=user, is_complete=is_complete, body_metrics=body_metrics)
