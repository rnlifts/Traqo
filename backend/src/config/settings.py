from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # App environment
    ENVIRONMENT: str = "development"

    # Secrets
    SECRET_KEY: str = "dev-secret-key-change-me"
    JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-me"

    # Database
    DATABASE_URL: str = "postgresql://postgres:HelloSql##33@127.0.0.1:5432/traqo_dev"
    TEST_DATABASE_URL: str = "postgresql://postgres:HelloSql##33@127.0.0.1:5432/traqo_test"

    class Config:
        env_file = ".env"


settings = Settings()
