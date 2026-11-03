from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_compose_has_isolated_services_and_one_migrator() -> None:
    config = yaml.safe_load((ROOT / "compose.yaml").read_text())
    services = config["services"]
    assert {"api", "worker", "migrate", "redis", "postgres"} <= services.keys()
    for name in ("redis", "postgres"):
        assert not services[name].get("ports")
        assert services[name]["healthcheck"]
    assert services["api"]["depends_on"]["migrate"]["condition"] == "service_completed_successfully"
    assert services["migrate"]["command"] == ["alembic", "upgrade", "head"]
    assert services["migrate"]["restart"] == "no"
    assert "--maxmemory-policy" in services["redis"]["command"]
    assert "noeviction" in services["redis"]["command"]
    assert services["worker"]["healthcheck"]["test"]
    assert "USER app" in (ROOT / "Dockerfile").read_text()
    assert ".env" in (ROOT / ".dockerignore").read_text().splitlines()


def test_postgresql_migration_compiles_offline() -> None:
    env = {**os.environ, "DATABASE_URL": "postgresql+asyncpg://u:p@localhost/test", "ENVIRONMENT": "test"}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "BIGSERIAL" in result.stdout
    assert "TIMESTAMP WITH TIME ZONE" in result.stdout
    assert "uq_bazaar_hourly_product_bucket" in result.stdout
