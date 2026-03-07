"""
Core configuration for the application.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",  # Ignore extra environment variables
    )

    # Application
    APP_NAME: str = "SciAgent"
    ENVIRONMENT: str = "development"  # development, production
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "mysql+aiomysql://root:password@localhost:3306/sciagent"
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Authentication
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Workspace
    WORKSPACE_BASE: str = "./workspaces"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
