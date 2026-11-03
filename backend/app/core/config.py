from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Runtime configuration.

    Secrets are only read from environment variables or a local `.env` file
    that is ignored by git. They are never returned by the API or written to
    logs.
    """

    model_config = SettingsConfigDict(
        env_file=DEFAULT_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "SkyBlock Companion API"
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    run_local_worker: bool = False
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    # Upstream. The key is optional at boot so the service can report a
    # misconfigured state instead of pretending profile data is available.
    hypixel_api_key: SecretStr | None = None
    hypixel_base_url: str = "https://api.hypixel.net/v2"
    mojang_base_url: str = "https://api.mojang.com"
    http_timeout_seconds: float = Field(default=15.0, gt=0, le=120)
    http_connect_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    upstream_max_retries: int = Field(default=2, ge=0, le=5)
    upstream_rate_limit_per_minute: int = Field(default=110, ge=10, le=120)
    upstream_queue_size: int = Field(default=200, ge=10, le=5000)
    upstream_request_timeout_seconds: float = 30.0
    max_response_bytes: int = Field(default=64 * 1024 * 1024, ge=1024 * 1024)

    # Shared cache.
    redis_url: str = "redis://localhost:6379/0"
    # Large entries (the full Auction House snapshot is >100 MB) need more than
    # a sub-second socket budget; ordinary cache operations still use a short one.
    redis_socket_timeout_seconds: float = Field(default=10.0, ge=1.0, le=60.0)
    cache_prefix: str = "sbc:v1"
    cache_ttl_bazaar: int = Field(default=20, ge=5, le=120)
    # One missed worker refresh must not make the snapshot stale: readers get a
    # window to load the next generation in the background instead of blocking.
    cache_ttl_auctions: int = Field(default=90, ge=15, le=300)
    cache_ttl_player: int = Field(default=90, ge=30, le=600)
    cache_ttl_profiles: int = Field(default=90, ge=30, le=600)
    cache_ttl_resources: int = Field(default=12 * 60 * 60, ge=3600, le=48 * 60 * 60)
    cache_stale_seconds: int = Field(default=3600, ge=60, le=24 * 60 * 60)
    cache_max_payload_bytes: int = Field(default=64 * 1024 * 1024, ge=1024 * 1024)
    cache_swr_enabled: bool = True

    # Public API protection.
    backend_rate_limit_per_minute: int = Field(default=120, ge=10, le=10000)
    max_request_body_bytes: int = Field(default=1024 * 1024, ge=1024, le=16 * 1024 * 1024)
    cors_origins: list[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
        "https://tauri.localhost",
    ]
    trusted_proxy_ips: list[str] = []

    # Database.
    database_url: str = "postgresql+asyncpg://skyblock:skyblock@localhost:5432/skyblock"
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_pool_timeout_seconds: float = 5.0
    database_status_timeout_seconds: float = Field(default=1.0, gt=0, le=5)
    database_echo: bool = False
    auto_create_tables: bool = False

    # Auctions and history.
    # Only the worker should build the full snapshot; API instances read it from
    # the shared cache to avoid duplicate multi-hundred-megabyte work.
    auction_snapshot_builder: bool = True
    auction_refresh_seconds: int = Field(default=45, ge=15, le=600)
    auction_fetch_concurrency: int = Field(default=4, ge=1, le=8)
    auction_max_pages: int = Field(default=100, ge=1, le=200)
    auction_snapshot_stale_seconds: int = Field(default=600, ge=60, le=3600)
    auction_api_max_page_size: int = Field(default=100, ge=10, le=500)
    history_interval_seconds: int = Field(default=300, ge=60, le=3600)
    history_raw_retention_hours: int = Field(default=168, ge=24, le=720)
    history_hourly_retention_days: int = Field(default=30, ge=7, le=365)
    history_max_points: int = Field(default=5000, ge=100, le=50000)
    cleanup_interval_seconds: int = Field(default=6 * 60 * 60, ge=600, le=86400)
    aggregate_interval_seconds: int = Field(default=3600, ge=300, le=86400)

    # Service identity.
    allowed_upstream_hosts: tuple[str, ...] = ("api.hypixel.net", "api.mojang.com")
    user_agent: str = "SkyBlockCompanionBackend/0.2 (+https://github.com/skyblock-companion)"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def hypixel_key_configured(self) -> bool:
        key = self.hypixel_api_key
        return bool(key and key.get_secret_value().strip())

    def validate_upstream_urls(self) -> None:
        for url, expected_host in (
            (self.hypixel_base_url, "api.hypixel.net"),
            (self.mojang_base_url, "api.mojang.com"),
        ):
            parsed = urlparse(url)
            if parsed.scheme != "https":
                raise ValueError("Upstream URL must use http(s)")
            if self.is_production and parsed.scheme != "https":
                raise ValueError("Upstream URL must use HTTPS in production")
            if parsed.hostname != expected_host or parsed.hostname not in self.allowed_upstream_hosts:
                raise ValueError(f"Upstream host is not allowlisted: {parsed.hostname}")
            if parsed.query or parsed.fragment or parsed.port not in (None, 443):
                raise ValueError("Upstream URL must not contain query, fragment or custom port")
            if parsed.username or parsed.password:
                raise ValueError("Upstream URL must not contain credentials")

    @model_validator(mode="after")
    def validate_security_posture(self) -> Settings:
        self.validate_upstream_urls()
        if self.run_local_worker and (self.environment != "development" or self.redis_url):
            raise ValueError("RUN_LOCAL_WORKER requires development mode and REDIS_URL empty; use one API process")
        if self.is_production:
            if not self.redis_url:
                raise ValueError("Production requires Redis for the shared upstream budget")
            if "*" in self.cors_origins:
                raise ValueError("Wildcard CORS is forbidden in production")
            if any(origin.startswith("http://") for origin in self.cors_origins):
                raise ValueError("Production CORS origins must use HTTPS")
            if self.debug:
                raise ValueError("Debug mode must be disabled in production")
            if self.auto_create_tables:
                raise ValueError("Schema creation must be disabled in production; use Alembic")
        if self.upstream_rate_limit_per_minute > 120:
            raise ValueError("Upstream budget above the documented Hypixel default is unsafe")
        parsed_db = urlparse(self.database_url.replace("+asyncpg", "").replace("+aiosqlite", ""))
        if parsed_db.scheme not in {"postgresql", "sqlite"}:
            raise ValueError("DATABASE_URL must be PostgreSQL or SQLite")
        return self

    def public_summary(self) -> dict[str, object]:
        """Safe configuration projection for /status. Never includes secrets."""
        return {
            "environment": self.environment,
            "hypixel_key_configured": self.hypixel_key_configured,
            "upstream_host": urlparse(self.hypixel_base_url).hostname,
            "redis_configured": bool(self.redis_url),
            "database_engine": urlparse(self.database_url).scheme,
            "cache_ttls": {
                "bazaar": self.cache_ttl_bazaar,
                "auctions": self.cache_ttl_auctions,
                "player": self.cache_ttl_player,
                "profiles": self.cache_ttl_profiles,
                "resources": self.cache_ttl_resources,
            },
        }


@lru_cache
def get_settings() -> Settings:
    # Tests and local tools may set SBC_ENV_FILE before importing the app.
    env_file = os.getenv("SBC_ENV_FILE") or DEFAULT_ENV_FILE
    return Settings(_env_file=env_file)
