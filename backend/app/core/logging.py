from __future__ import annotations

import logging
import re
from contextvars import ContextVar

_record_factory = logging.getLogRecordFactory()

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_SECRET_PATTERNS = (
    re.compile(r"(?i)(api[-_]?key\s*[=:]\s*)[^\s,;\"']+"),
    re.compile(r"(?i)(authorization\s*[=:]\s*bearer\s+)[^\s,;\"']+"),
    re.compile(r"(?i)(x-api-key\s*[=:]\s*)[^\s,;\"']+"),
    re.compile(r"(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),
)


def redact_secrets(value: str) -> str:
    """Best-effort redaction applied to every formatted log record."""
    result = value
    for pattern in _SECRET_PATTERNS:
        result = pattern.sub(lambda match: match.group(1) + "***" if match.lastindex else "***", result)
    return result


class RedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - defensive logging guard
            message = str(record.msg)
        record.msg = redact_secrets(message)
        record.args = ()
        if record.exc_info:
            # Exception text can contain URLs or headers. Keep the type only and
            # let structured fields carry the diagnostic context.
            record.exc_text = redact_secrets(logging.Formatter().formatException(record.exc_info))
            record.exc_info = None
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RedactionFilter())
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    old_factory = _record_factory

    def record_factory(*args, **kwargs):  # type: ignore[no-untyped-def]
        record = old_factory(*args, **kwargs)
        record.request_id = request_id_var.get()
        return record

    logging.setLogRecordFactory(record_factory)
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel("WARNING")
