"""
Application configuration.

Loads settings from environment variables using pydantic-settings.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "smart-building-platform"
    app_env: str = "development"
    app_debug: bool = False
    app_log_level: str = "INFO"

    # --- FastAPI ---
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_workers: int = 1

    # --- PostgreSQL ---
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "smart_building"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    # --- Redis ---
    redis_host: str = "localhost"
    redis_port: int = 6379

    # --- Security ---
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30

    # --- CORS ---
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    @property
    def database_url(self) -> str:
        """Build async database URL from components."""
        from sqlalchemy.engine import URL

        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    @property
    def database_url_sync(self) -> str:
        """Build sync database URL (for Alembic)."""
        from sqlalchemy.engine import URL

        return URL.create(
            drivername="postgresql",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    @property
    def redis_url(self) -> str:
        """Build Redis URL from components."""
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
