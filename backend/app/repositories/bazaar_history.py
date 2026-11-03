from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.errors import DatabaseUnavailableError
from app.models.database import Database
from app.models.domain import BazaarHourlyPoint, BazaarPricePoint, BazaarSnapshot

logger = logging.getLogger(__name__)


class BazaarHistoryRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def record_snapshot(
        self,
        *,
        snapshot_id: str,
        fetched_at: datetime,
        products: dict[str, dict[str, Any]],
        upstream_last_updated: int | None = None,
    ) -> bool:
        rows = []
        for product_id, product in products.items():
            quick = product.get("quick_status")
            if not quick or "buyPrice" not in quick or "sellPrice" not in quick:
                continue
            rows.append(
                {
                    "snapshot_id": snapshot_id,
                    "product_id": product_id,
                    "ts": fetched_at,
                    "buy_price": float(quick.get("buyPrice") or 0),
                    "sell_price": float(quick.get("sellPrice") or 0),
                    "buy_volume": float(quick.get("buyVolume") or 0),
                    "sell_volume": float(quick.get("sellVolume") or 0),
                }
            )
        if not rows:
            return False
        try:
            async with self.database.session() as session:
                existing = await session.scalar(
                    select(BazaarSnapshot.id).where(BazaarSnapshot.snapshot_id == snapshot_id)
                )
                if existing:
                    logger.info("Snapshot already stored snapshot_id=%s", snapshot_id)
                    return False
                session.add(
                    BazaarSnapshot(
                        snapshot_id=snapshot_id,
                        fetched_at=fetched_at,
                        product_count=len(rows),
                        upstream_last_updated=upstream_last_updated,
                    )
                )
                await session.flush()
                for start in range(0, len(rows), 500):
                    await session.execute(BazaarPricePoint.__table__.insert(), rows[start : start + 500])
            logger.info("Stored bazaar snapshot snapshot_id=%s products=%s", snapshot_id, len(rows))
            return True
        except IntegrityError:
            logger.info("Duplicate snapshot race snapshot_id=%s", snapshot_id)
            return False
        except SQLAlchemyError as exc:
            logger.warning("Failed to store bazaar snapshot error=%s", type(exc).__name__)
            raise DatabaseUnavailableError("Price history storage is unavailable") from exc

    async def history(
        self,
        product_id: str,
        *,
        since: datetime,
        hourly: bool = False,
        limit: int = 5000,
    ) -> list[dict[str, Any]]:
        model = BazaarHourlyPoint if hourly else BazaarPricePoint
        ts_column = model.bucket_ts if hourly else model.ts
        try:
            async with self.database.session() as session:
                statement = (
                    select(
                        ts_column,
                        model.buy_price,
                        model.sell_price,
                        model.buy_volume,
                        model.sell_volume,
                    )
                    .where(model.product_id == product_id, ts_column >= since)
                    .order_by(ts_column.asc())
                    .limit(limit)
                )
                result = await session.execute(statement)
                return [
                    {
                        "ts": row[0].replace(tzinfo=UTC) if row[0].tzinfo is None else row[0],
                        "buy_price": row[1],
                        "sell_price": row[2],
                        "buy_volume": row[3],
                        "sell_volume": row[4],
                    }
                    for row in result.all()
                ]
        except SQLAlchemyError as exc:
            raise DatabaseUnavailableError("Price history storage is unavailable") from exc

    async def record_job(
        self,
        job_name: str,
        *,
        status: str,
        started_at: datetime,
        finished_at: datetime | None = None,
        items: int = 0,
        error: str | None = None,
    ) -> None:
        from app.models.domain import RefreshJob

        try:
            async with self.database.session() as session:
                session.add(
                    RefreshJob(
                        job_name=job_name,
                        status=status,
                        started_at=started_at,
                        finished_at=finished_at,
                        items_processed=items,
                        error=(error or "")[:500] or None,
                    )
                )
        except SQLAlchemyError:
            logger.warning("Could not persist refresh job job=%s", job_name)

    async def aggregate_hourly(self, since: datetime) -> int:
        """Aggregate raw points into hourly buckets.

        PostgreSQL uses date_trunc + ON CONFLICT. SQLite is supported for local
        tests via strftime. Values are averages, volumes are sums.
        """
        since = since.replace(minute=0, second=0, microsecond=0)
        dialect = self.database.engine.dialect.name
        try:
            async with self.database.session() as session:
                if dialect == "postgresql":
                    from sqlalchemy import text

                    statement = text(
                        """
                        INSERT INTO bazaar_hourly_points
                            (product_id, bucket_ts, buy_price, sell_price, buy_volume, sell_volume, samples)
                        SELECT product_id,
                               date_trunc('hour', ts) AS bucket_ts,
                               avg(buy_price), avg(sell_price),
                               sum(buy_volume), sum(sell_volume), count(*)
                        FROM bazaar_price_points
                        WHERE ts >= :since
                        GROUP BY product_id, date_trunc('hour', ts)
                        ON CONFLICT (product_id, bucket_ts) DO UPDATE SET
                            buy_price = EXCLUDED.buy_price,
                            sell_price = EXCLUDED.sell_price,
                            buy_volume = EXCLUDED.buy_volume,
                            sell_volume = EXCLUDED.sell_volume,
                            samples = EXCLUDED.samples
                        """
                    )
                    result = await session.execute(statement, {"since": since})
                    return result.rowcount or 0
                # Portable fallback: fetch and aggregate in Python.
                rows = await session.execute(
                    select(
                        BazaarPricePoint.product_id,
                        BazaarPricePoint.ts,
                        BazaarPricePoint.buy_price,
                        BazaarPricePoint.sell_price,
                        BazaarPricePoint.buy_volume,
                        BazaarPricePoint.sell_volume,
                    ).where(BazaarPricePoint.ts >= since)
                )
                buckets: dict[tuple[str, datetime], list[float]] = {}
                for product_id, ts, buy, sell, buy_vol, sell_vol in rows.all():
                    bucket = ts.replace(minute=0, second=0, microsecond=0)
                    key = (product_id, bucket)
                    current = buckets.setdefault(key, [0.0, 0.0, 0.0, 0.0, 0.0])
                    current[0] += buy
                    current[1] += sell
                    current[2] += buy_vol
                    current[3] += sell_vol
                    current[4] += 1
                payload = [
                    {
                        "product_id": product_id,
                        "bucket_ts": bucket,
                        "buy_price": values[0] / values[4],
                        "sell_price": values[1] / values[4],
                        "buy_volume": values[2],
                        "sell_volume": values[3],
                        "samples": int(values[4]),
                    }
                    for (product_id, bucket), values in buckets.items()
                ]
                if payload:
                    insert = sqlite_insert(BazaarHourlyPoint).values(payload)
                    insert = insert.on_conflict_do_update(
                        index_elements=["product_id", "bucket_ts"],
                        set_={
                            "buy_price": insert.excluded.buy_price,
                            "sell_price": insert.excluded.sell_price,
                            "buy_volume": insert.excluded.buy_volume,
                            "sell_volume": insert.excluded.sell_volume,
                            "samples": insert.excluded.samples,
                        },
                    )
                    await session.execute(insert)
                return len(payload)
        except SQLAlchemyError as exc:
            logger.warning("Hourly aggregation failed error=%s", type(exc).__name__)
            raise DatabaseUnavailableError("Hourly aggregation failed") from exc

    async def cleanup(self, *, raw_before: datetime, hourly_before: datetime) -> dict[str, int]:
        try:
            async with self.database.session() as session:
                old_snapshots = select(BazaarSnapshot.snapshot_id).where(BazaarSnapshot.fetched_at < raw_before)
                points = await session.execute(
                    delete(BazaarPricePoint).where(BazaarPricePoint.snapshot_id.in_(old_snapshots))
                )
                snapshots = await session.execute(delete(BazaarSnapshot).where(BazaarSnapshot.fetched_at < raw_before))
                hourly = await session.execute(
                    delete(BazaarHourlyPoint).where(BazaarHourlyPoint.bucket_ts < hourly_before)
                )
                return {
                    "points": points.rowcount or 0,
                    "snapshots": snapshots.rowcount or 0,
                    "hourly": hourly.rowcount or 0,
                }
        except SQLAlchemyError as exc:
            raise DatabaseUnavailableError("Retention cleanup failed") from exc

    async def stats(self) -> dict[str, Any]:
        try:
            async with self.database.session() as session:
                snapshots = await session.scalar(select(func.count(BazaarSnapshot.id)))
                points = await session.scalar(select(func.count(BazaarPricePoint.id)))
                hourly = await session.scalar(select(func.count(BazaarHourlyPoint.id)))
                latest = await session.scalar(select(func.max(BazaarSnapshot.fetched_at)))
                return {
                    "snapshots": int(snapshots or 0),
                    "raw_points": int(points or 0),
                    "hourly_points": int(hourly or 0),
                    "latest_snapshot": latest.isoformat() if latest else None,
                }
        except (SQLAlchemyError, OSError, TimeoutError) as exc:
            raise DatabaseUnavailableError("History statistics unavailable") from exc


def utcnow() -> datetime:
    return datetime.now(UTC)


def retention_cutoffs(raw_hours: int, hourly_days: int) -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    return now - timedelta(hours=raw_hours), now - timedelta(days=hourly_days)
