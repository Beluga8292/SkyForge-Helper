from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
import uuid
import zlib
from collections.abc import Iterator

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.cache.base import CacheBackend, CacheEntry

logger = logging.getLogger(__name__)


SNAPSHOT_LIMIT = 256 * 1024 * 1024 + 4096
# A single Redis command carrying the whole snapshot blocks the server for
# several seconds. Chunks keep each command small so small cache operations
# (status, bazaar, rate limits) are served between them.
SNAPSHOT_CHUNK_CHARS = 4 * 1024 * 1024
SNAPSHOT_POINTER_VERSION = 2
OLD_GENERATION_GRACE_SECONDS = 120


def snapshot_chunks(payload: dict, size: int = SNAPSHOT_CHUNK_CHARS) -> Iterator[str]:
    """Serialize the snapshot as plain JSON, yielding at most `size` characters.

    Compression measured ~22 s per refresh (zlib level 1 + base64) and decoding
    ~10 s while saving only ~23 MiB, so plain JSON is chunked instead. Streaming
    the encoder also avoids materializing the whole ~100 MB string: that string
    was the worker's memory high-water mark and its repeated allocation grew
    RSS until the container hit its limit.
    """
    encoder = json.JSONEncoder(ensure_ascii=False, separators=(",", ":"))
    buffer: list[str] = []
    pending = 0
    total = 0
    for part in encoder.iterencode(payload):
        buffer.append(part)
        pending += len(part)
        if pending < size:
            continue
        text = "".join(buffer)
        buffer = []
        offset = 0
        while len(text) - offset >= size:
            total += size
            if total > SNAPSHOT_LIMIT:
                raise ValueError("Auction snapshot exceeds limit")
            yield text[offset : offset + size]
            offset += size
        if offset < len(text):
            buffer = [text[offset:]]
            pending = len(text) - offset
        else:
            pending = 0
    if buffer:
        text = "".join(buffer)
        total += len(text)
        if total > SNAPSHOT_LIMIT:
            raise ValueError("Auction snapshot exceeds limit")
        if text:
            yield text


def encode_snapshot(payload: dict) -> str:
    """Full serialized form, kept for tests and small snapshots."""
    return "".join(snapshot_chunks(payload))


def decode_payload(raw: str) -> dict:
    if raw.startswith("z1:"):
        # Entries written by the previous compressed format remain readable.
        decoder = zlib.decompressobj()
        decoded = decoder.decompress(base64.b64decode(raw[3:], validate=True), SNAPSHOT_LIMIT + 1)
        if len(decoded) > SNAPSHOT_LIMIT or decoder.unconsumed_tail or not decoder.eof or decoder.unused_data:
            raise ValueError("Invalid or oversized auction snapshot")
        return json.loads(decoded)
    if len(raw) > SNAPSHOT_LIMIT:
        raise ValueError("Auction snapshot exceeds limit")
    return json.loads(raw)


class RedisCache(CacheBackend):
    def __init__(
        self,
        url: str,
        *,
        prefix: str = "sbc:v1",
        max_payload_bytes: int = 64 * 1024 * 1024,
        socket_timeout: float = 0.25,
    ) -> None:
        self._prefix = prefix
        self._max_payload_bytes = max_payload_bytes
        self._client = Redis.from_url(
            url,
            decode_responses=True,
            socket_timeout=socket_timeout,
            socket_connect_timeout=socket_timeout,
            health_check_interval=30,
        )
        self._last_error: str | None = None

    def _key(self, key: str) -> str:
        return f"{self._prefix}:cache:{key}"

    def _chunk_key(self, key: str, generation: str, index: int) -> str:
        return f"{self._key(key)}:chunk:{generation}:{index}"

    @staticmethod
    def _entry_from(payload: dict) -> CacheEntry:
        return CacheEntry(
            value=payload["value"],
            fetched_at=float(payload["fetched_at"]),
            stored_at=float(payload["stored_at"]),
            ttl=float(payload["ttl"]),
            stale_ttl=float(payload["stale_ttl"]),
            version=payload.get("version"),
            metadata=payload.get("metadata") or {},
        )

    @staticmethod
    def _pointer_from(raw: str) -> dict | None:
        if raw.startswith("z1:"):
            return None
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None
        if isinstance(data, dict) and data.get("v") == SNAPSHOT_POINTER_VERSION and "chunks" in data:
            return data
        return None

    async def _read_snapshot(self, key: str, raw: str) -> CacheEntry:
        pointer = self._pointer_from(raw)
        if pointer is None:
            payload = await asyncio.to_thread(decode_payload, raw)
            return self._entry_from(payload)
        parts = []
        for index in range(int(pointer["chunks"])):
            part = await self._client.get(self._chunk_key(key, str(pointer["gen"]), index))
            if part is None:
                raise ValueError("Auction snapshot chunk is missing")
            parts.append(part)
        payload = await asyncio.to_thread(decode_payload, "".join(parts))
        entry = self._entry_from(payload)
        # The API compares generations to avoid re-parsing an unchanged snapshot.
        entry.metadata = {**(entry.metadata or {}), "gen": str(pointer["gen"])}
        return entry

    async def get(self, key: str) -> CacheEntry | None:
        try:
            raw = await self._client.get(self._key(key))
        except (TimeoutError, RedisError, OSError) as exc:
            self._last_error = type(exc).__name__
            raise
        if not raw:
            return None
        try:
            if key == "auctions:snapshot":
                return await self._read_snapshot(key, raw)
            payload = await asyncio.to_thread(decode_payload, raw)
            return self._entry_from(payload)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, zlib.error):
            logger.warning("Discarding malformed cache entry key=%s", key)
            await self.delete(key)
            return None

    async def _chunk_keys_by_generation(self, key: str) -> dict[str, list[str]]:
        groups: dict[str, list[str]] = {}
        pattern = f"{self._key(key)}:chunk:*"
        async for raw_key in self._client.scan_iter(match=pattern, count=200):
            name = str(raw_key)
            generation = name.rsplit(":chunk:", 1)[-1].split(":", 1)[0]
            groups.setdefault(generation, []).append(name)
        return groups

    async def _live_generation(self, key: str) -> str | None:
        raw = await self._client.get(self._key(key))
        if not raw:
            return None
        pointer = self._pointer_from(raw)
        if not pointer or not pointer.get("gen"):
            return None
        return str(pointer["gen"])

    async def _delete_keys(self, names: list[str]) -> None:
        if not names:
            return
        try:
            await self._client.delete(*names)
        except (TimeoutError, RedisError, OSError) as exc:
            logger.warning("Could not delete auction snapshot chunks error=%s", type(exc).__name__)

    async def _drop_orphan_generations(self, key: str) -> str | None:
        """Delete chunks no pointer references and return the live generation.

        Chunks from an interrupted publication are unreachable by definition, so
        freeing them before the next write is safe and breaks the deadlock where
        a full Redis rejects the very writes that would clean it up.
        """
        try:
            live = await self._live_generation(key)
            orphans = [
                name
                for generation, names in (await self._chunk_keys_by_generation(key)).items()
                if generation != live
                for name in names
            ]
            if orphans:
                await self._delete_keys(orphans)
                logger.info("Dropped unreachable auction snapshot chunks count=%s", len(orphans))
            return live
        except (TimeoutError, RedisError, OSError) as exc:
            logger.warning("Could not inspect auction snapshot generations error=%s", type(exc).__name__)
            return None

    async def _expire_generation(self, key: str, generation: str) -> None:
        try:
            groups = await self._chunk_keys_by_generation(key)
        except (TimeoutError, RedisError, OSError) as exc:
            logger.warning("Could not expire previous auction snapshot error=%s", type(exc).__name__)
            return
        for name in groups.get(generation, []):
            try:
                # LT: never extend an existing shorter TTL, otherwise every
                # publish would postpone expiry and generations would pile up.
                await self._client.expire(name, OLD_GENERATION_GRACE_SECONDS, lt=True)
            except (TimeoutError, RedisError, OSError) as exc:
                logger.warning("Could not expire auction snapshot chunk error=%s", type(exc).__name__)
                return

    async def _set_snapshot(self, key: str, entry: CacheEntry) -> None:
        envelope = {
            "value": entry.value,
            "fetched_at": entry.fetched_at,
            "stored_at": entry.stored_at,
            "ttl": entry.ttl,
            "stale_ttl": entry.stale_ttl,
            "version": entry.version,
            "metadata": entry.metadata,
        }
        ttl = max(1, int(entry.ttl + entry.stale_ttl))
        generation = uuid.uuid4().hex[:16]
        live = await self._drop_orphan_generations(key)
        written: list[str] = []
        try:
            for index, chunk in enumerate(snapshot_chunks(envelope)):
                chunk_key = self._chunk_key(key, generation, index)
                await self._client.set(chunk_key, chunk, ex=ttl)
                written.append(chunk_key)
            pointer = {
                "v": SNAPSHOT_POINTER_VERSION,
                "gen": generation,
                "chunks": len(written) or 1,
                "fetched_at": entry.fetched_at,
                "stored_at": entry.stored_at,
                "ttl": entry.ttl,
                "stale_ttl": entry.stale_ttl,
                "version": entry.version,
                "metadata": entry.metadata,
                "meta": {
                    "snapshot_id": entry.value.get("snapshot_id"),
                    "total_auctions": entry.value.get("total_auctions"),
                    "last_updated": entry.value.get("last_updated"),
                    "total_pages": entry.value.get("total_pages"),
                },
            }
            await self._client.set(self._key(key), json.dumps(pointer, separators=(",", ":")), ex=ttl)
        except (TimeoutError, RedisError, OSError) as exc:
            # The pointer was never swapped, so these chunks are unreachable:
            # delete them instead of pinning a full orphan snapshot for an hour.
            await self._delete_keys(written)
            self._last_error = type(exc).__name__
            raise

        # In-flight readers still finish from the previous generation; its
        # expiry is bounded. Without this cleanup a publish every 45 s kept
        # three or four ~100 MB generations alive and Redis hit maxmemory,
        # which then failed the very writes that would have cleaned them up.
        if live and live != generation:
            await self._expire_generation(key, live)

    async def set(self, key: str, entry: CacheEntry) -> None:
        if key == "auctions:snapshot":
            await self._set_snapshot(key, entry)
            return
        envelope = {
            "value": entry.value,
            "fetched_at": entry.fetched_at,
            "stored_at": entry.stored_at,
            "ttl": entry.ttl,
            "stale_ttl": entry.stale_ttl,
            "version": entry.version,
            "metadata": entry.metadata,
        }
        payload = await asyncio.to_thread(json.dumps, envelope, separators=(",", ":"), ensure_ascii=False)
        payload_bytes = await asyncio.to_thread(str.encode, payload, "utf-8")
        if len(payload_bytes) > self._max_payload_bytes:
            raise ValueError("Redis cache payload exceeds limit")
        ttl = max(1, int(entry.ttl + entry.stale_ttl))
        try:
            await self._client.set(self._key(key), payload_bytes, ex=ttl)
        except (TimeoutError, RedisError, OSError) as exc:
            self._last_error = type(exc).__name__
            raise

    async def get_snapshot_meta(self, key: str = "auctions:snapshot") -> dict | None:
        """Read only the small pointer: /status must never parse the snapshot."""
        raw = await self._client.get(self._key(key))
        if not raw:
            return None
        pointer = self._pointer_from(raw)
        if pointer is None:
            return None
        meta = dict(pointer.get("meta") or {})
        meta.update(
            {
                "fetched_at": pointer.get("fetched_at"),
                "stored_at": pointer.get("stored_at"),
                "ttl": pointer.get("ttl"),
                "stale_ttl": pointer.get("stale_ttl"),
                "metadata": pointer.get("metadata") or {},
                "gen": pointer.get("gen"),
                "chunks": pointer.get("chunks"),
            }
        )
        return meta

    async def delete(self, key: str) -> None:
        try:
            await self._client.delete(self._key(key))
        except (TimeoutError, RedisError, OSError) as exc:
            self._last_error = type(exc).__name__
            raise

    async def ping(self) -> bool:
        try:
            return bool(await asyncio.wait_for(self._client.ping(), timeout=0.5))
        except (TimeoutError, RedisError, OSError) as exc:
            self._last_error = type(exc).__name__
            return False

    async def close(self) -> None:
        await self._client.aclose()

    async def try_lock(self, name: str, token: str, ttl_seconds: int) -> bool:
        try:
            return bool(await self._client.set(f"{self._prefix}:lock:{name}", token, nx=True, ex=ttl_seconds))
        except (TimeoutError, RedisError, OSError):
            return False

    async def owns_lock(self, name: str, token: str) -> bool:
        return await self._client.get(f"{self._prefix}:lock:{name}") == token

    async def release_lock(self, name: str, token: str) -> None:
        script = """
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        end
        return 0
        """
        try:
            await self._client.eval(script, 1, f"{self._prefix}:lock:{name}", token)
        except (TimeoutError, RedisError, OSError):
            return

    async def increment_window(self, name: str, window_seconds: int, limit: int) -> tuple[bool, int, int]:
        """Atomic fixed-window limiter shared by API/worker processes."""
        now = int(time.time())
        window = now // window_seconds
        key = f"{self._prefix}:rate:{name}:{window}"
        script = """
        local current = redis.call('incr', KEYS[1])
        if current == 1 then
          redis.call('expire', KEYS[1], ARGV[1])
        end
        return current
        """
        try:
            current = int(await self._client.eval(script, 1, key, window_seconds + 1))
        except (TimeoutError, RedisError, OSError):
            raise
        reset = (window + 1) * window_seconds
        return current <= limit, max(0, limit - current), max(1, reset - now)

    async def try_take_token(self, name: str, limit: int, period_seconds: int) -> tuple[bool, int, int]:
        """Atomic rolling-window budget, using Redis time across all processes."""
        key = f"{self._prefix}:budget:{name}"
        cooldown_key = f"{self._prefix}:cooldown:{name}"
        script = """
        local clock = redis.call('time')
        local now = tonumber(clock[1]) * 1000 + tonumber(clock[2]) / 1000
        local period = tonumber(ARGV[2]) * 1000
        local cooldown = redis.call('pttl', KEYS[2])
        if cooldown > 0 then return {0, cooldown, 0} end
        redis.call('zremrangebyscore', KEYS[1], '-inf', now - period)
        local count = redis.call('zcard', KEYS[1])
        if count >= tonumber(ARGV[1]) then
          local oldest = redis.call('zrange', KEYS[1], 0, 0, 'WITHSCORES')
          return {0, math.ceil(tonumber(oldest[2]) + period - now), 0}
        end
        redis.call('zadd', KEYS[1], now, ARGV[3])
        redis.call('pexpire', KEYS[1], period + 1000)
        return {1, 0, tonumber(ARGV[1]) - count - 1}
        """
        result = await self._client.eval(script, 2, key, cooldown_key, limit, period_seconds, uuid.uuid4().hex)
        allowed, wait_ms, remaining = (int(value) for value in result)
        return bool(allowed), wait_ms, remaining

    async def set_cooldown(self, name: str, seconds: float) -> None:
        script = """
        local ttl = redis.call('pttl', KEYS[1])
        if ttl < tonumber(ARGV[1]) then
          redis.call('psetex', KEYS[1], ARGV[1], '1')
        end
        return 1
        """
        await self._client.eval(script, 1, f"{self._prefix}:cooldown:{name}", max(1, int(seconds * 1000)))
