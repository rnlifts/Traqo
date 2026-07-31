from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # App environment
    ENVIRONMENT: str = "development"

    # Secrets
    SECRET_KEY: str = "dev-secret-key-change-me"
    JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-me"

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/traqo_dev"
    TEST_DATABASE_URL: str = "postgresql://user:password@localhost:5432/traqo_test"

    # CORS — comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = "http://localhost:5173"

    # Login lockout — per-account failed-attempt tracking
    LOGIN_LOCKOUT_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_DURATION_MINUTES: int = 15

    class Config:
        env_file = ".env"


settings = Settings()

# Validate production secrets
if settings.ENVIRONMENT == "production":
    if settings.SECRET_KEY == "dev-secret-key-change-me":
        raise RuntimeError("SECRET_KEY must be set to a real value in production")
    if settings.JWT_SECRET_KEY == "dev-jwt-secret-key-change-me":
        raise RuntimeError("JWT_SECRET_KEY must be set to a real value in production")
