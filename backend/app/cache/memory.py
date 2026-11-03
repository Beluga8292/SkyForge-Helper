from __future__ import annotations

from app.cache.base import CacheBackend, CacheEntry


class InMemoryCache(CacheBackend):
    """Process-local emergency fallback.

    Used in tests and when Redis is temporarily unavailable. The API must keep
    serving cached/stale data rather than failing every request during a Redis
    outage. The fallback is not shared between workers; that limitation is
    reported by /status.
    """

    def __init__(self, max_entries: int = 2048) -> None:
        self._items: dict[str, CacheEntry] = {}
        self._max_entries = max_entries

    async def get(self, key: str) -> CacheEntry | None:
        entry = self._items.get(key)
        if entry is None:
            return None
        if entry.expires_at <= 0:
            return entry
        if entry.stored_at + entry.ttl + entry.stale_ttl < __import__("time").time():
            self._items.pop(key, None)
            return None
        return entry

    async def set(self, key: str, entry: CacheEntry) -> None:
        if len(self._items) >= self._max_entries and key not in self._items:
            oldest = min(self._items, key=lambda item: self._items[item].stored_at)
            self._items.pop(oldest, None)
        self._items[key] = entry

    async def delete(self, key: str) -> None:
        self._items.pop(key, None)

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        self._items.clear()

    def clear(self) -> None:
        self._items.clear()

    @property
    def size(self) -> int:
        return len(self._items)
