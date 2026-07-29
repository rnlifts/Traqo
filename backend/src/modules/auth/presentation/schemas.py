from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    """Register request schema."""

    display_name: str = Field(..., min_length=1)
    username: str = Field(..., pattern=r"^[a-z][a-z0-9_]{2,19}$")
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        # Normalize before the pattern check runs, so a mixed-case username
        # (e.g. from an API caller other than this app's own frontend, which
        # always lowercases client-side) doesn't get rejected on casing alone
        # — the server must not rely on the client having already normalized it.
        return value.strip().lower() if isinstance(value, str) else value


class RegisterResponse(BaseModel):
    """Register response schema."""

    message: str
    username: str


class CheckUsernameResponse(BaseModel):
    """Check username availability response schema."""

    available: bool
    reason: str | None = None


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
