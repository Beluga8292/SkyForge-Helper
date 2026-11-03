from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class CacheEntry:
    value: dict[str, Any]
    fetched_at: float
    stored_at: float
    ttl: float
    stale_ttl: float
    version: str | None = None
    expires_at: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def age_seconds(self) -> float:
        return max(0.0, self.stored_at - self.fetched_at)

    @property
    def is_fresh(self) -> bool:
        return (self.stored_at + self.ttl) > __import__("time").time()

    @property
    def is_usable(self) -> bool:
        return (self.stored_at + self.ttl + self.stale_ttl) > __import__("time").time()


class CacheBackend(Protocol):
    async def get(self, key: str) -> CacheEntry | None: ...

    async def set(self, key: str, entry: CacheEntry) -> None: ...

    async def delete(self, key: str) -> None: ...

    async def ping(self) -> bool: ...

    async def close(self) -> None: ...
