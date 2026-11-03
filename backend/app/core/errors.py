from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Transport-safe application error with a stable machine code."""

    status_code = 500
    code = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        retry_after: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.retry_after = retry_after
        self.details = details or {}

    def public_body(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.retry_after is not None:
            body["retry_after_seconds"] = self.retry_after
        if self.details:
            body["details"] = self.details
        return body


class ConfigurationError(AppError):
    status_code = 503
    code = "backend_misconfigured"


class MissingApiKeyError(ConfigurationError):
    code = "hypixel_key_missing"

    def __init__(self) -> None:
        super().__init__("Hypixel API key is not configured on the backend")


class UpstreamError(AppError):
    status_code = 502
    code = "upstream_error"


class UpstreamTimeoutError(UpstreamError):
    status_code = 504
    code = "upstream_timeout"


class UpstreamAuthError(UpstreamError):
    status_code = 502
    code = "upstream_auth"


class UpstreamForbiddenError(UpstreamError):
    status_code = 502
    code = "upstream_forbidden"


class UpstreamRateLimitedError(UpstreamError):
    status_code = 503
    code = "upstream_rate_limited"


class UpstreamBudgetUnavailableError(UpstreamError):
    status_code = 503
    code = "upstream_budget_unavailable"


class UpstreamNotFoundError(UpstreamError):
    status_code = 404
    code = "not_found"


class UpstreamUnavailableError(UpstreamError):
    status_code = 503
    code = "upstream_unavailable"


class UpstreamInvalidResponseError(UpstreamError):
    status_code = 502
    code = "upstream_invalid_response"


class QueueOverflowError(AppError):
    status_code = 503
    code = "upstream_queue_full"


class CacheUnavailableError(AppError):
    status_code = 503
    code = "cache_unavailable"


class DatabaseUnavailableError(AppError):
    status_code = 503
    code = "database_unavailable"


class RequestValidationError(AppError):
    status_code = 422
    code = "validation_error"


class InvalidRequestError(RequestValidationError):
    """Client-supplied value that passed routing but is not a valid domain id."""
