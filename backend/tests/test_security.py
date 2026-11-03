from __future__ import annotations

import logging

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import RedactionFilter, redact_secrets


def test_api_key_is_redacted_from_log_messages() -> None:
    message = "Calling upstream with API-Key: super-secret-value and authorization: Bearer abc.def"
    cleaned = redact_secrets(message)
    assert "super-secret-value" not in cleaned
    assert "abc.def" not in cleaned
    assert "***" in cleaned


def test_redaction_filter_rewrites_record_and_exception_text() -> None:
    record = logging.LogRecord(
        name="test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg="x-api-key=leaked-value",
        args=(),
        exc_info=None,
    )
    assert RedactionFilter().filter(record) is True
    assert "leaked-value" not in record.getMessage()


def test_production_rejects_insecure_configuration() -> None:
    base = {
        "_env_file": None,
        "environment": "production",
        "database_url": "postgresql+asyncpg://u:p@db:5432/skyblock",
        "redis_url": "redis://redis:6379/0",
        "cors_origins": ["https://app.example.com"],
        "debug": False,
        "auto_create_tables": False,
    }
    Settings(**base)
    with pytest.raises(ValidationError):
        Settings(**{**base, "debug": True})
    with pytest.raises(ValidationError):
        Settings(**{**base, "cors_origins": ["*"]})
    with pytest.raises(ValidationError):
        Settings(**{**base, "cors_origins": ["http://evil.example.com"]})
    with pytest.raises(ValidationError):
        Settings(**{**base, "auto_create_tables": True})


def test_upstream_host_allowlist_is_enforced() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="test",
            database_url="sqlite+aiosqlite:///:memory:",
            hypixel_base_url="https://attacker.example.com/v2",
        )


def test_public_summary_never_contains_secret() -> None:
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url="sqlite+aiosqlite:///:memory:",
        hypixel_api_key="top-secret-key",
    )
    summary = settings.public_summary()
    assert summary["hypixel_key_configured"] is True
    assert "top-secret-key" not in str(summary)
