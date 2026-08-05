from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.infrastructure.security.jwt_service import decode_access_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Dependency to extract and validate the current user ID from the JWT token.

    Raises:
        HTTPException: If token is missing or invalid (401 Unauthorized).

    Returns:
        The authenticated user's ID.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return user_id


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> int | None:
    """Dependency to extract the user ID from a JWT token if present, otherwise return None.

    This is like get_current_user_id but does not error if no token is provided.
    Invalid tokens (where decode fails) return None, not 401.

    Returns:
        The authenticated user's ID, or None if unauthenticated or token is invalid.
    """
    if not credentials or not credentials.credentials:
        return None

    user_id = decode_access_token(credentials.credentials)
    return user_id
