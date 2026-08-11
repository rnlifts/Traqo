"""Unit tests for get_user_profile.py."""

import pytest

from src.modules.auth.application.use_cases.get_user_profile import GetUserProfile
from src.modules.auth.domain.entities.user import User
from src.modules.auth.domain.exceptions import UserNotFoundError


class InMemoryUserRepo:
    def __init__(self):
        self.users = {}

    def add(self, user: User):
        self.users[user.id] = user

    def get_by_id(self, user_id):
        return self.users.get(user_id)


class TestGetUserProfileIncomplete:
    def test_new_user_with_no_profile_fields_is_incomplete_with_null_metrics(self):
        repo = InMemoryUserRepo()
        repo.add(User(id=1, username="a", display_name="A", password_hash="x"))
        use_case = GetUserProfile(repo)

        result = use_case.execute(1)

        assert result.is_complete is False
        assert result.body_metrics is None

    def test_partially_filled_profile_is_still_incomplete(self):
        repo = InMemoryUserRepo()
        repo.add(User(id=1, username="a", display_name="A", password_hash="x", age=25, weight_kg=70))
        use_case = GetUserProfile(repo)

        result = use_case.execute(1)

        assert result.is_complete is False
        assert result.body_metrics is None


class TestGetUserProfileComplete:
    def test_complete_profile_returns_computed_body_metrics(self):
        repo = InMemoryUserRepo()
        repo.add(User(
            id=1, username="a", display_name="A", password_hash="x",
            age=25, weight_kg=70, height_cm=175, gender="male", activity_level="moderate",
        ))
        use_case = GetUserProfile(repo)

        result = use_case.execute(1)

        assert result.is_complete is True
        assert result.body_metrics is not None
        assert result.body_metrics.bmi == 22.9


class TestGetUserProfileNotFound:
    def test_raises_when_user_id_does_not_resolve(self):
        repo = InMemoryUserRepo()
        use_case = GetUserProfile(repo)

        with pytest.raises(UserNotFoundError):
            use_case.execute(999)
