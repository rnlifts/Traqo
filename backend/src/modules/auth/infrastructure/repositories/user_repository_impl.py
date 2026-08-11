from sqlalchemy import func
from sqlalchemy.orm import Session

from ...domain.entities.user import User
from ...domain.interfaces.user_repository import UserRepository
from ..models.user_model import UserModel


class UserRepositoryImpl(UserRepository):
    """Implements UserRepository against SQLAlchemy."""

    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def get_by_username(self, username: str) -> User | None:
        """Retrieve a user by username."""
        model = self.session.query(UserModel).filter_by(username=username).first()
        if not model:
            return None
        return self._model_to_entity(model)

    def get_by_id(self, user_id: int) -> User | None:
        """Retrieve a user by id."""
        model = self.session.query(UserModel).get(user_id)
        if not model:
            return None
        return self._model_to_entity(model)

    def get_by_username_case_insensitive(self, username: str) -> User | None:
        """Retrieve a user by username, ignoring case."""
        model = (
            self.session.query(UserModel)
            .filter(func.lower(UserModel.username) == username.lower())
            .first()
        )
        if not model:
            return None
        return self._model_to_entity(model)

    def save(self, user: User) -> User:
        """Persist a user (create or update)."""
        if user.id:
            # Update existing
            model = self.session.query(UserModel).get(user.id)
            model.username = user.username
            model.display_name = user.display_name
            model.password_hash = user.password_hash
            model.age = user.age
            model.weight_kg = user.weight_kg
            model.height_cm = user.height_cm
            model.gender = user.gender
            model.activity_level = user.activity_level
        else:
            # Create new
            model = UserModel(
                username=user.username,
                display_name=user.display_name,
                password_hash=user.password_hash,
                created_at=user.created_at,
                age=user.age,
                weight_kg=user.weight_kg,
                height_cm=user.height_cm,
                gender=user.gender,
                activity_level=user.activity_level,
            )
            self.session.add(model)

        self.session.commit()
        return self._model_to_entity(model)

    def exists_by_username(self, username: str) -> bool:
        """Check if a username already exists."""
        return self.session.query(UserModel).filter_by(username=username).first() is not None

    def record_failed_login(self, user: User) -> None:
        """Increment failed login attempts and set lockout if threshold reached."""
        from src.config.settings import settings
        from datetime import datetime, timedelta

        model = self.session.get(UserModel, user.id)
        model.failed_login_attempts += 1

        if model.failed_login_attempts >= settings.LOGIN_LOCKOUT_MAX_ATTEMPTS:
            model.locked_until = datetime.utcnow() + timedelta(
                minutes=settings.LOGIN_LOCKOUT_DURATION_MINUTES
            )

        self.session.commit()

    def reset_login_attempts(self, user: User) -> None:
        """Clear failed login attempts and lockout state on successful login."""
        model = self.session.get(UserModel, user.id)
        model.failed_login_attempts = 0
        model.locked_until = None
        self.session.commit()

    def _model_to_entity(self, model: UserModel) -> User:
        """Convert a SQLAlchemy model to a domain entity."""
        return User(
            id=model.id,
            username=model.username,
            display_name=model.display_name,
            password_hash=model.password_hash,
            created_at=model.created_at,
            failed_login_attempts=model.failed_login_attempts,
            locked_until=model.locked_until,
            age=model.age,
            weight_kg=model.weight_kg,
            height_cm=model.height_cm,
            gender=model.gender,
            activity_level=model.activity_level,
        )
