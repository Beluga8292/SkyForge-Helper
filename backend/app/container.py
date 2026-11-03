from __future__ import annotations

import asyncio
import logging

import httpx

from app.cache.memory import InMemoryCache
from app.cache.redis import RedisCache
from app.cache.service import CacheService, ResilientCache
from app.clients.hypixel import HypixelClient, MojangClient
from app.core.config import Settings
from app.core.metrics import Metrics
from app.core.rate_limit import BackendRateLimiter, UpstreamRateLimiter
from app.models.database import Database
from app.repositories.bazaar_history import BazaarHistoryRepository
from app.services.auctions import AuctionSnapshotService
from app.services.bazaar import BazaarService
from app.services.players import MojangService, PlayerService
from app.services.resources import ResourceService

logger = logging.getLogger(__name__)


class Container:
    def __init__(
        self,
        *,
        settings: Settings,
        database: Database,
        redis: RedisCache | None,
        cache: ResilientCache,
        cache_service: CacheService,
        limiter: UpstreamRateLimiter,
        backend_limiter: BackendRateLimiter,
        client: HypixelClient,
        mojang_client: MojangClient,
        history: BazaarHistoryRepository,
        bazaar: BazaarService,
        auctions: AuctionSnapshotService,
        players: PlayerService,
        mojang: MojangService,
        resources: ResourceService,
        metrics: Metrics,
    ) -> None:
        self.settings = settings
        self.database = database
        self.redis = redis
        self.cache = cache
        self.cache_service = cache_service
        self.limiter = limiter
        self.backend_limiter = backend_limiter
        self.client = client
        self.mojang_client = mojang_client
        self.history = history
        self.bazaar = bazaar
        self.auctions = auctions
        self.players = players
        self.mojang = mojang
        self.resources = resources
        self.metrics = metrics
        # /status is polled continuously; the database summary is cached briefly
        # so a desktop polling loop cannot turn into a history-query loop.
        self.status_db_cache: tuple[float, bool, dict] | None = None
        self.status_db_lock = asyncio.Lock()
        from app.services.market.service import MarketService

        self.market = MarketService(self)

    @classmethod
    async def create(
        cls,
        settings: Settings,
        *,
        redis: RedisCache | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> Container:
        metrics = Metrics()
        database = Database(
            settings.database_url,
            pool_size=settings.database_pool_size,
            pool_timeout=settings.database_pool_timeout_seconds,
            echo=settings.database_echo,
        )
        if settings.auto_create_tables:
            try:
                await database.create_all()
            except BaseException:
                await database.close()
                raise

        if redis is None and settings.redis_url:
            redis = RedisCache(
                settings.redis_url,
                prefix=settings.cache_prefix,
                max_payload_bytes=settings.cache_max_payload_bytes,
                socket_timeout=settings.redis_socket_timeout_seconds,
            )
        # Only consumers of the snapshot preload it; the worker publishes it.
        cache_backend = ResilientCache(redis, InMemoryCache(), preload_snapshot=not settings.auction_snapshot_builder)
        if redis is not None:
            available = await cache_backend.ping()
            if not available:
                logger.warning("Redis is not reachable at startup; using memory cache fallback")
        cache_service = CacheService(
            cache_backend,
            max_payload_bytes=settings.cache_max_payload_bytes,
            swr_enabled=settings.cache_swr_enabled,
        )
        limiter = UpstreamRateLimiter(
            limit_per_minute=settings.upstream_rate_limit_per_minute,
            queue_size=settings.upstream_queue_size,
            redis=redis,
            metrics=metrics,
        )
        limiter.start()
        backend_limiter = BackendRateLimiter(
            limit_per_minute=settings.backend_rate_limit_per_minute,
            redis=redis,
            metrics=metrics,
        )
        key = settings.hypixel_api_key.get_secret_value() if settings.hypixel_api_key else None
        client = HypixelClient(
            base_url=settings.hypixel_base_url,
            api_key=key,
            timeout_seconds=settings.http_timeout_seconds,
            connect_timeout_seconds=settings.http_connect_timeout_seconds,
            max_retries=settings.upstream_max_retries,
            max_response_bytes=settings.max_response_bytes,
            limiter=limiter,
            metrics=metrics,
            user_agent=settings.user_agent,
            transport=transport,
        )
        mojang_client = MojangClient(
            base_url=settings.mojang_base_url,
            timeout_seconds=settings.http_timeout_seconds,
            limiter=limiter,
            metrics=metrics,
            user_agent=settings.user_agent,
            transport=transport,
        )
        history = BazaarHistoryRepository(database)
        return cls(
            settings=settings,
            database=database,
            redis=redis,
            cache=cache_backend,
            cache_service=cache_service,
            limiter=limiter,
            backend_limiter=backend_limiter,
            client=client,
            mojang_client=mojang_client,
            history=history,
            bazaar=BazaarService(
                client=client,
                cache=cache_service,
                history=history,
                ttl=settings.cache_ttl_bazaar,
                stale_ttl=settings.cache_stale_seconds,
            ),
            auctions=AuctionSnapshotService(
                client=client,
                cache=cache_service,
                ttl=settings.cache_ttl_auctions,
                stale_ttl=settings.auction_snapshot_stale_seconds,
                concurrency=settings.auction_fetch_concurrency,
                max_pages=settings.auction_max_pages,
                max_page_size=settings.auction_api_max_page_size,
                builder=settings.auction_snapshot_builder,
            ),
            players=PlayerService(
                client=client,
                cache=cache_service,
                player_ttl=settings.cache_ttl_player,
                profiles_ttl=settings.cache_ttl_profiles,
                stale_ttl=settings.cache_stale_seconds,
            ),
            mojang=MojangService(client=mojang_client, cache=cache_service),
            resources=ResourceService(
                client=client,
                cache=cache_service,
                ttl=settings.cache_ttl_resources,
                stale_ttl=settings.cache_stale_seconds,
            ),
            metrics=metrics,
        )

    async def close(self) -> None:
        await self.market.close()
        await self.cache_service.close()
        await self.limiter.close()
        await self.client.close()
        await self.mojang_client.close()
        await self.database.close()
