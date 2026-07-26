from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.rate_limiter import limiter
from src.infrastructure.security.jwt_service import create_access_token
from ..application.use_cases.login_user import LoginUser
from ..application.use_cases.register_user import RegisterUser
from ..domain.exceptions import InvalidCredentialsError
from ..infrastructure.repositories.user_repository_impl import UserRepositoryImpl
from ..infrastructure.security.bcrypt_password_hasher import BcryptPasswordHasher
from .schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
password_hasher = BcryptPasswordHasher()


@auth_router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, req: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new user."""
    user_repository = UserRepositoryImpl(db)
    use_case = RegisterUser(user_repository, password_hasher)
    user = use_case.execute(req.display_name, req.password)
    return RegisterResponse(message="Account created successfully", username=user.username)


@auth_router.post("/login", response_model=LoginResponse)
@limiter.limit("3/15minutes")
async def login(request: Request, req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    user_repository = UserRepositoryImpl(db)
    use_case = LoginUser(user_repository, password_hasher)
    user = use_case.execute(req.username, req.password)
    token = create_access_token(user.id)
    return LoginResponse(
        token=token,
        user=LoginResponse.User(username=user.username, display_name=user.display_name),
    )
