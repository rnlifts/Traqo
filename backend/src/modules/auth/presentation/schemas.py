from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """Register request schema."""

    display_name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=128)


class RegisterResponse(BaseModel):
    """Register response schema."""

    message: str
    username: str


class LoginRequest(BaseModel):
    """Login request schema."""

    username: str = Field(..., min_length=1)
    password: str = Field(...)


class LoginResponse(BaseModel):
    """Login response schema."""

    token: str

    class User(BaseModel):
        username: str
        display_name: str

    user: User
