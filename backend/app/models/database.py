from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

logger = logging.getLogger(__name__)


class Database:
    def __init__(
        self,
        url: str,
        *,
        pool_size: int = 5,
        pool_timeout: float = 5.0,
        echo: bool = False,
    ) -> None:
        kwargs: dict[str, object] = {"echo": echo, "pool_pre_ping": True}
        if not url.startswith("sqlite"):
            kwargs.update(
                pool_size=pool_size,
                max_overflow=pool_size,
                pool_timeout=pool_timeout,
                connect_args={
                    "timeout": pool_timeout,
                    "command_timeout": pool_timeout,
                    "server_settings": {"timezone": "UTC"},
                },
            )
        self.operation_timeout = pool_timeout
        self.engine: AsyncEngine = create_async_engine(url, **kwargs)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def ping(self) -> bool:
        try:
            async with asyncio.timeout(self.operation_timeout):
                async with self.engine.connect() as connection:
                    await connection.execute(text("SELECT 1"))
            return True
        except Exception as exc:
            logger.warning("Database ping failed error=%s", type(exc).__name__)
            return False

    async def create_all(self) -> None:
        from app.models import domain  # noqa: F401 - register mappings
        from app.models.base import Base

        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def close(self) -> None:
        await self.engine.dispose()
