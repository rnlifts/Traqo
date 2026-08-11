"""Unit tests for update_user_profile.py."""

import pytest

from src.modules.auth.application.use_cases.update_user_profile import UpdateUserProfile
from src.modules.auth.domain.entities.user import User
from src.modules.auth.domain.exceptions import InvalidProfileFieldError, UserNotFoundError


class InMemoryUserRepo:
    def __init__(self):
        self.users = {}

    def add(self, user: User):
        self.users[user.id] = user

    def get_by_id(self, user_id):
        return self.users.get(user_id)

    def save(self, user: User) -> User:
        self.users[user.id] = user
        return user


def make_user():
    return User(id=1, username="a", display_name="A", password_hash="x")


class TestUpdateUserProfileSuccess:
    def test_sets_all_fields(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        updated = use_case.execute(
            1, age=25, weight_kg=70, height_cm=175, gender="male", activity_level="moderate"
        )

        assert updated.age == 25
        assert updated.weight_kg == 70
        assert updated.height_cm == 175
        assert updated.gender == "male"
        assert updated.activity_level == "moderate"
        assert repo.get_by_id(1).age == 25

    def test_all_genders_and_activity_levels_are_accepted(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        for gender in ("male", "female", "other"):
            updated = use_case.execute(1, age=25, weight_kg=70, height_cm=175, gender=gender, activity_level="active")
            assert updated.gender == gender


class TestUpdateUserProfileValidation:
    def test_rejects_non_positive_age(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        with pytest.raises(InvalidProfileFieldError):
            use_case.execute(1, age=0, weight_kg=70, height_cm=175, gender="male", activity_level="moderate")

    def test_rejects_non_positive_weight(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        with pytest.raises(InvalidProfileFieldError):
            use_case.execute(1, age=25, weight_kg=-5, height_cm=175, gender="male", activity_level="moderate")

    def test_rejects_invalid_gender(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        with pytest.raises(InvalidProfileFieldError):
            use_case.execute(1, age=25, weight_kg=70, height_cm=175, gender="robot", activity_level="moderate")

    def test_rejects_invalid_activity_level(self):
        repo = InMemoryUserRepo()
        repo.add(make_user())
        use_case = UpdateUserProfile(repo)

        with pytest.raises(InvalidProfileFieldError):
            use_case.execute(1, age=25, weight_kg=70, height_cm=175, gender="male", activity_level="超active")

    def test_raises_when_user_not_found(self):
        repo = InMemoryUserRepo()
        use_case = UpdateUserProfile(repo)

        with pytest.raises(UserNotFoundError):
            use_case.execute(999, age=25, weight_kg=70, height_cm=175, gender="male", activity_level="moderate")
