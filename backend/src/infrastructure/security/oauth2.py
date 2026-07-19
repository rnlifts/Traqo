from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.infrastructure.security.jwt_service import decode_access_token

security = HTTPBearer()


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
