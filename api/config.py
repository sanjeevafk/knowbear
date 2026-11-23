import os
import sys
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_dotenv(path: Path, override: bool = False) -> None:
    """Minimal .env parser using Python stdlib."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[7:].strip()
        value = value.strip().strip("'\"")
        if key and (override or key not in os.environ):
            os.environ[key] = value


# Load project .env with override=True so .env takes precedence over shell env
_load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)
_load_dotenv(Path(".env"), override=True)


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
