from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import DatabaseUnavailableError
from app.models.database import Database
from app.repositories.bazaar_history import BazaarHistoryRepository, retention_cutoffs
from tests.conftest import BAZAAR_PAYLOAD


async def fresh_repository(tmp_path) -> tuple[Database, BazaarHistoryRepository]:
    database = Database(f"sqlite+aiosqlite:///{tmp_path / 'history.db'}")
    await database.create_all()
    return database, BazaarHistoryRepository(database)


def products() -> dict:
    return BAZAAR_PAYLOAD["products"]


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
async def test_duplicate_history_snapshots_are_ignored(tmp_path) -> None:
    database, repository = await fresh_repository(tmp_path)
    try:
        now = datetime.now(UTC)
        first = await repository.record_snapshot(
            snapshot_id="bz-1", fetched_at=now, products=products(), upstream_last_updated=1
        )
        second = await repository.record_snapshot(
            snapshot_id="bz-1", fetched_at=now, products=products(), upstream_last_updated=1
        )
        third = await repository.record_snapshot(
            snapshot_id="bz-2", fetched_at=now + timedelta(minutes=5), products=products()
        )
        assert first is True
        assert second is False
        assert third is True
        stats = await repository.stats()
        assert stats["snapshots"] == 2
        assert stats["raw_points"] == 4
    finally:
        await database.close()


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
async def test_history_returns_real_points_in_order(tmp_path) -> None:
    database, repository = await fresh_repository(tmp_path)
    try:
        base = datetime.now(UTC) - timedelta(minutes=30)
        await repository.record_snapshot(snapshot_id="bz-a", fetched_at=base, products=products())
        await repository.record_snapshot(
            snapshot_id="bz-b", fetched_at=base + timedelta(minutes=5), products=products()
        )
        rows = await repository.history("ENCHANTED_DIAMOND", since=base - timedelta(minutes=1))
        assert len(rows) == 2
        assert rows[0]["ts"] < rows[1]["ts"]
        assert rows[0]["buy_price"] == 120.0
        assert await repository.history("UNKNOWN", since=base) == []
    finally:
        await database.close()


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
async def test_hourly_aggregation_and_retention(tmp_path) -> None:
    database, repository = await fresh_repository(tmp_path)
    try:
        base = datetime.now(UTC).replace(minute=10, second=0, microsecond=0)
        for index in range(3):
            await repository.record_snapshot(
                snapshot_id=f"bz-{index}",
                fetched_at=base + timedelta(minutes=index * 5),
                products=products(),
            )
        inserted = await repository.aggregate_hourly(since=base - timedelta(hours=1))
        assert inserted == 2
        hourly = await repository.history("ENCHANTED_DIAMOND", since=base - timedelta(hours=1), hourly=True)
        assert len(hourly) == 1
        assert hourly[0]["buy_price"] == 120.0

        raw_before, hourly_before = retention_cutoffs(1, 30)
        removed = await repository.cleanup(raw_before=raw_before, hourly_before=hourly_before)
        assert removed["points"] == 0
        assert removed["snapshots"] == 0

        removed = await repository.cleanup(
            raw_before=datetime.now(UTC) + timedelta(hours=1),
            hourly_before=datetime.now(UTC) + timedelta(hours=1),
        )
        assert removed["points"] == 6
        assert removed["snapshots"] == 3
        assert removed["hourly"] == 2
    finally:
        await database.close()


async def test_database_unavailable_raises_domain_error() -> None:
    database = Database("sqlite+aiosqlite:////nonexistent-directory-for-tests/history.db")
    repository = BazaarHistoryRepository(database)
    try:
        assert await database.ping() is False
        with pytest.raises(DatabaseUnavailableError):
            await repository.history("ENCHANTED_DIAMOND", since=datetime.now(UTC))
        with pytest.raises(DatabaseUnavailableError):
            await repository.aggregate_hourly(since=datetime.now(UTC))
        with pytest.raises(DatabaseUnavailableError):
            await repository.stats()
    finally:
        await database.close()


async def test_batch_history_and_rollback(tmp_path) -> None:
    from app.models.domain import BazaarSnapshot

    database, repository = await fresh_repository(tmp_path)
    try:
        now = datetime.now(UTC)
        with pytest.raises(RuntimeError):
            async with database.session() as session:
                session.add(BazaarSnapshot(snapshot_id="rollback", fetched_at=now, product_count=0))
                await session.flush()
                raise RuntimeError("rollback")
        assert (await repository.stats())["snapshots"] == 0
        template = products()["ENCHANTED_DIAMOND"]
        batch = {f"ITEM_{i}": template for i in range(1101)}
        assert await repository.record_snapshot(snapshot_id="batch", fetched_at=now, products=batch)
        assert (await repository.stats())["raw_points"] == 1101
        assert not await repository.record_snapshot(snapshot_id="batch", fetched_at=now, products=batch)
        rows = await repository.history("ITEM_1100", since=now - timedelta(seconds=1))
        assert rows[0]["ts"].tzinfo is not None
    finally:
        await database.close()


async def test_partial_hour_aggregation_does_not_overwrite_full_hour(tmp_path) -> None:
    database, repository = await fresh_repository(tmp_path)
    try:
        base = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        first = {"X": {"quick_status": {"buyPrice": 100, "sellPrice": 50}}}
        second = {"X": {"quick_status": {"buyPrice": 200, "sellPrice": 60}}}
        await repository.record_snapshot(snapshot_id="a", fetched_at=base + timedelta(minutes=1), products=first)
        await repository.record_snapshot(snapshot_id="b", fetched_at=base + timedelta(minutes=40), products=second)
        await repository.aggregate_hourly(since=base)
        await repository.aggregate_hourly(since=base + timedelta(minutes=30))
        rows = await repository.history("X", since=base, hourly=True)
        assert rows[0]["buy_price"] == 150
    finally:
        await database.close()
