"""initial bazaar history schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bazaar_snapshots",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("product_count", sa.Integer(), nullable=False),
        sa.Column("upstream_last_updated", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_bazaar_snapshots"),
        sa.UniqueConstraint("snapshot_id", name="uq_bazaar_snapshots_snapshot_id"),
    )
    op.create_index("ix_bazaar_snapshots_fetched_at", "bazaar_snapshots", ["fetched_at"])

    op.create_table(
        "bazaar_price_points",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("product_id", sa.String(length=96), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("buy_price", sa.Float(), nullable=False),
        sa.Column("sell_price", sa.Float(), nullable=False),
        sa.Column("buy_volume", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sell_volume", sa.Float(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["bazaar_snapshots.snapshot_id"],
            name="fk_bazaar_price_points_snapshot_id_bazaar_snapshots",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_bazaar_price_points"),
        sa.UniqueConstraint(
            "snapshot_id", "product_id", name="uq_bazaar_point_snapshot_product"
        ),
    )
    op.create_index(
        "ix_bazaar_points_product_ts", "bazaar_price_points", ["product_id", "ts"]
    )
    op.create_index("ix_bazaar_points_ts", "bazaar_price_points", ["ts"])

    op.create_table(
        "bazaar_hourly_points",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.String(length=96), nullable=False),
        sa.Column("bucket_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("buy_price", sa.Float(), nullable=False),
        sa.Column("sell_price", sa.Float(), nullable=False),
        sa.Column("buy_volume", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sell_volume", sa.Float(), nullable=False, server_default="0"),
        sa.Column("samples", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id", name="pk_bazaar_hourly_points"),
        sa.UniqueConstraint(
            "product_id", "bucket_ts", name="uq_bazaar_hourly_product_bucket"
        ),
    )
    op.create_index(
        "ix_bazaar_hourly_product_ts", "bazaar_hourly_points", ["product_id", "bucket_ts"]
    )

    op.create_table(
        "refresh_jobs",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("job_name", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("items_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_jobs"),
    )
    op.create_index("ix_refresh_jobs_job_name", "refresh_jobs", ["job_name"])

    op.create_table(
        "operational_events",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("level", sa.String(length=16), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("message", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_operational_events"),
    )
    op.create_index("ix_operational_events_ts", "operational_events", ["ts"])


def downgrade() -> None:
    op.drop_index("ix_operational_events_ts", table_name="operational_events")
    op.drop_table("operational_events")
    op.drop_index("ix_refresh_jobs_job_name", table_name="refresh_jobs")
    op.drop_table("refresh_jobs")
    op.drop_index("ix_bazaar_hourly_product_ts", table_name="bazaar_hourly_points")
    op.drop_table("bazaar_hourly_points")
    op.drop_index("ix_bazaar_points_ts", table_name="bazaar_price_points")
    op.drop_index("ix_bazaar_points_product_ts", table_name="bazaar_price_points")
    op.drop_table("bazaar_price_points")
    op.drop_index("ix_bazaar_snapshots_fetched_at", table_name="bazaar_snapshots")
    op.drop_table("bazaar_snapshots")
