from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_alembic_migration_applies_to_sqlite(tmp_path) -> None:
    database = tmp_path / "migrated.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite+aiosqlite:///{database}",
        "ENVIRONMENT": "test",
        "REDIS_URL": "",
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert database.exists()

    with sqlite3.connect(database) as connection:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        indexes = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='index'")}
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    assert {
        "bazaar_snapshots",
        "bazaar_price_points",
        "bazaar_hourly_points",
        "refresh_jobs",
        "operational_events",
    } <= tables
    assert "ix_bazaar_points_product_ts" in indexes
    assert revision == ("0001_initial",)
