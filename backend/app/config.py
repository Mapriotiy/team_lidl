from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Team LIDL API"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+psycopg://lidl:lidl@localhost:5432/lidl"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    openrouter_api_key: str | None = None
    assessment_model: str | None = None
    assessment_timeout_seconds: float = 60
    research_budget_usd: float = 5
    source_text_retention_days: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
