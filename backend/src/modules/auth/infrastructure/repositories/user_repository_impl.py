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

    def save(self, user: User) -> User:
        """Persist a user (create or update)."""
        if user.id:
            # Update existing
            model = self.session.query(UserModel).get(user.id)
            model.username = user.username
            model.display_name = user.display_name
            model.password_hash = user.password_hash
        else:
            # Create new
            model = UserModel(
                username=user.username,
                display_name=user.display_name,
                password_hash=user.password_hash,
                created_at=user.created_at,
            )
            self.session.add(model)

        self.session.commit()
        return self._model_to_entity(model)

    def exists_by_username(self, username: str) -> bool:
        """Check if a username already exists."""
        return self.session.query(UserModel).filter_by(username=username).first() is not None

    def _model_to_entity(self, model: UserModel) -> User:
        """Convert a SQLAlchemy model to a domain entity."""
        return User(
            id=model.id,
            username=model.username,
            display_name=model.display_name,
            password_hash=model.password_hash,
            created_at=model.created_at,
        )
