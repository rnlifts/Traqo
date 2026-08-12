from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.rate_limiter import limiter
from src.infrastructure.security.jwt_service import create_access_token
from src.infrastructure.security.oauth2 import get_current_user_id
from ..application.use_cases.get_user_profile import GetUserProfile
from ..application.use_cases.login_user import LoginUser
from ..application.use_cases.register_user import RegisterUser
from ..application.use_cases.update_user_profile import UpdateUserProfile
from ..domain.exceptions import (
    InvalidCredentialsError,
    AccountLockedError,
    InvalidProfileFieldError,
    UserNotFoundError,
)
from ..domain.services.username_validator import UsernameValidator
from ..infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from ..infrastructure.security.bcrypt_password_hasher import BcryptPasswordHasher
from .schemas import (
    BodyMetricsResponse,
    CheckUsernameResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UpdateProfileRequest,
    UserProfileResponse,
)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
password_hasher = BcryptPasswordHasher()


def _to_profile_response(result) -> UserProfileResponse:
    return UserProfileResponse(
        username=result.user.username,
        display_name=result.user.display_name,
        age=result.user.age,
        weight_kg=result.user.weight_kg,
        height_cm=result.user.height_cm,
        gender=result.user.gender,
        activity_level=result.user.activity_level,
        is_complete=result.is_complete,
        body_metrics=(
            BodyMetricsResponse(
                bmi=result.body_metrics.bmi,
                bmr=result.body_metrics.bmr,
                maintenance_calories=result.body_metrics.maintenance_calories,
            )
            if result.body_metrics
            else None
        ),
    )


@auth_router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new user."""
    user_repository = UserRepositoryImpl(db)
    use_case = RegisterUser(user_repository, password_hasher)
    user = use_case.execute(req.display_name, req.username, req.password)
    return RegisterResponse(message="Account created successfully", username=user.username)


@auth_router.get("/check-username", response_model=CheckUsernameResponse)
@limiter.limit("20/minute")
async def check_username(username: str, request: Request, response: Response, db: Session = Depends(get_db)):
    """Check if a username is available."""
    # Normalize the username
    normalized = UsernameValidator.normalize(username)

    # Check format first (cheap, no DB query)
    is_valid, error_message = UsernameValidator.validate_format(normalized)
    if not is_valid:
        return CheckUsernameResponse(available=False, reason=error_message)

    # Check if username exists in database
    user_repository = UserRepositoryImpl(db)
    if user_repository.exists_by_username(normalized):
        return CheckUsernameResponse(available=False, reason="Username is already taken")

    # Username is available
    return CheckUsernameResponse(available=True)


@auth_router.post("/login", response_model=LoginResponse)
@limiter.limit("15/15minutes")
async def login(request: Request, req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    user_repository = UserRepositoryImpl(db)
    use_case = LoginUser(user_repository, password_hasher)
    try:
        user = use_case.execute(req.username, req.password)
    except AccountLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account is locked due to too many failed login attempts. Try again later.",
            headers={"Retry-After": str(e.retry_after_seconds)},
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(user.id)
    return LoginResponse(
        token=token,
        user=LoginResponse.User(username=user.username, display_name=user.display_name),
    )


@auth_router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the authenticated user's profile, with computed body metrics if complete."""
    user_repository = UserRepositoryImpl(db)
    use_case = GetUserProfile(user_repository)
    try:
        result = use_case.execute(user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_profile_response(result)


@auth_router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    req: UpdateProfileRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's profile fields."""
    user_repository = UserRepositoryImpl(db)
    use_case = UpdateUserProfile(user_repository)
    try:
        use_case.execute(
            user_id,
            age=req.age,
            weight_kg=req.weight_kg,
            height_cm=req.height_cm,
            gender=req.gender,
            activity_level=req.activity_level,
        )
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except InvalidProfileFieldError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    result = GetUserProfile(user_repository).execute(user_id)
    return _to_profile_response(result)
