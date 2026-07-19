from datetime import datetime, timedelta

from jose import JWTError, jwt

from src.config.settings import settings


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token for the given user.

    Args:
        user_id: The user's ID to encode in the token.
        expires_delta: Optional expiration time delta. Defaults to 24 hours.

    Returns:
        JWT token as a string.
    """
    if expires_delta is None:
        expires_delta = timedelta(days=1)

    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_access_token(token: str) -> int | None:
    """Decode a JWT access token and return the user ID.

    Args:
        token: JWT token to decode.

    Returns:
        User ID if token is valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, ValueError):
        return None
