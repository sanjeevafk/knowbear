import os
import sys
from functools import lru_cache
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load project .env with override=True so .env takes precedence over shell env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)
load_dotenv(".env", override=True)


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    token_rate_limit_enabled: bool = True
    token_rate_limit_per_ip_hour: int = 12000


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    settings = Settings()
    if not settings.openrouter_api_key:
        print("WARNING: OPENROUTER_API_KEY not set. Vision models will fail.", file=sys.stderr)
    if not settings.groq_api_key:
        print("WARNING: GROQ_API_KEY not set. Groq models will fail.", file=sys.stderr)
    return settings
