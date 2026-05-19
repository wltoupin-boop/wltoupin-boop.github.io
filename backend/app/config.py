"""
Application configuration using Pydantic Settings.

All values are loaded from environment variables (or a .env file during
local development). Secrets are never hard-coded here.
"""

from __future__ import annotations

import json
import base64
from functools import lru_cache
from typing import Literal, List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object — instantiate once, share everywhere."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------
    environment: Literal["development", "staging", "production"] = "development"
    secret_key: str = Field(..., min_length=32)
    debug: bool = False
    log_level: str = "info"
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    database_url: str = Field(..., description="Async SQLAlchemy database URL")
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_pool_timeout: int = 30

    @field_validator("database_url", mode="before")
    @classmethod
    def ensure_async_driver(cls, v: str) -> str:
        """Ensure URL uses the asyncpg driver."""
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # ------------------------------------------------------------------
    # Redis
    # ------------------------------------------------------------------
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 300

    # ------------------------------------------------------------------
    # Firebase Auth
    # ------------------------------------------------------------------
    firebase_project_id: str = Field(..., description="Firebase project ID")
    firebase_service_account_key_path: str = ""
    firebase_service_account_key: str = ""  # base64 or raw JSON string

    def get_firebase_credentials(self) -> dict | None:
        """Return parsed Firebase service account JSON or None."""
        if self.firebase_service_account_key_path:
            import json as _json
            with open(self.firebase_service_account_key_path) as fh:
                return _json.load(fh)
        if self.firebase_service_account_key:
            raw = self.firebase_service_account_key
            try:
                # Try base64 first
                decoded = base64.b64decode(raw).decode("utf-8")
                return json.loads(decoded)
            except Exception:
                return json.loads(raw)
        return None

    # ------------------------------------------------------------------
    # Anthropic / Claude
    # ------------------------------------------------------------------
    anthropic_api_key: str = Field(..., description="Anthropic API key")
    anthropic_model: str = "claude-opus-4-5"
    anthropic_max_tokens: int = 4096

    # ------------------------------------------------------------------
    # External API bases
    # ------------------------------------------------------------------
    clinicaltrials_api_base: str = "https://clinicaltrials.gov/api/v2"
    openfda_api_base: str = "https://api.fda.gov"
    pubmed_api_base: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    pubmed_api_key: str = ""

    # ------------------------------------------------------------------
    # Google Cloud
    # ------------------------------------------------------------------
    gcs_bucket_name: str = Field(..., description="GCS bucket for documents")
    google_cloud_project: str = ""
    cloud_tasks_queue: str = Field(..., description="Cloud Tasks queue name")
    cloud_tasks_location: str = "us-central1"

    # ------------------------------------------------------------------
    # Sentry
    # ------------------------------------------------------------------
    sentry_dsn: str = ""

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------
    rate_limit_per_minute: int = 60
    ai_rate_limit_per_minute: int = 10

    # ------------------------------------------------------------------
    # Derived helpers
    # ------------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
