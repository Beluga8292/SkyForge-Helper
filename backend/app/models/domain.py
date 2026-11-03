from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

BigIntPk = BigInteger().with_variant(Integer, "sqlite")


class BazaarSnapshot(Base, TimestampMixin):
    __tablename__ = "bazaar_snapshots"

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    product_count: Mapped[int] = mapped_column(Integer, nullable=False)
    upstream_last_updated: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class BazaarPricePoint(Base):
    __tablename__ = "bazaar_price_points"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "product_id", name="uq_bazaar_point_snapshot_product"),
        Index("ix_bazaar_points_product_ts", "product_id", "ts"),
        Index("ix_bazaar_points_ts", "ts"),
    )

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("bazaar_snapshots.snapshot_id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[str] = mapped_column(String(96), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    buy_price: Mapped[float] = mapped_column(Float, nullable=False)
    sell_price: Mapped[float] = mapped_column(Float, nullable=False)
    buy_volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    sell_volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)


class BazaarHourlyPoint(Base):
    __tablename__ = "bazaar_hourly_points"
    __table_args__ = (
        UniqueConstraint("product_id", "bucket_ts", name="uq_bazaar_hourly_product_bucket"),
        Index("ix_bazaar_hourly_product_ts", "product_id", "bucket_ts"),
    )

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(String(96), nullable=False)
    bucket_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    buy_price: Mapped[float] = mapped_column(Float, nullable=False)
    sell_price: Mapped[float] = mapped_column(Float, nullable=False)
    buy_volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    sell_volume: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    samples: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class RefreshJob(Base, TimestampMixin):
    __tablename__ = "refresh_jobs"

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="running")
    items_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)


class OperationalEvent(Base, TimestampMixin):
    __tablename__ = "operational_events"
    __table_args__ = (Index("ix_operational_events_ts", "ts"),)

    id: Mapped[int] = mapped_column(BigIntPk, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
