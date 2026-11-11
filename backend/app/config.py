from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    access_token_minutes: int = 60 * 24 * 7
    database_url: str = f"sqlite:///{BASE_DIR / 'syllabus.db'}"
    frontend_url: str = "http://localhost:3000"
    upload_dir: Path = BASE_DIR / "uploads"

    # Free AI providers (tried in this order)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    # Optional paid provider
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/google/callback"
    default_timezone: str = "America/Chicago"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key or self.groq_api_key or self.anthropic_api_key)

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
