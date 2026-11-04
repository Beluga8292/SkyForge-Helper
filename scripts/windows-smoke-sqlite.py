"""Write and verify a settings row for the Windows uninstall smoke test."""
from pathlib import Path
import json
import os
import sqlite3
import sys

if len(sys.argv) != 3 or sys.argv[1] not in {"set", "get", "seed-upgrade", "verify-upgrade"}:
    raise SystemExit("usage: windows-smoke-sqlite.py set|get|seed-upgrade|verify-upgrade <database>")
mode, database = sys.argv[1], Path(sys.argv[2])
if not database.is_file():
    raise SystemExit(f"database not found: {database}")

with sqlite3.connect(database) as connection:
    if mode in {"seed-upgrade", "verify-upgrade"}:
        if os.environ.get("GITHUB_ACTIONS") != "true" or sys.platform != "win32":
            raise SystemExit("Upgrade fixtures require disposable Windows Actions runner")
        fixture = json.dumps({"language": "en", "dataMode": "demo", "demoMode": True,
            "lastProfile": {"uuid": "0" * 32, "name": "UpgradeFixture",
                            "profileId": "1" * 32, "profileName": "Fixture"}})
        if mode == "seed-upgrade":
            connection.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('sbc:settings',?)", (fixture,))
            connection.execute("INSERT OR REPLACE INTO watchlist(product_id,added_at,target_price) VALUES('ENCHANTED_DIAMOND',1,42.5)")
            connection.commit()
        assert connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        assert connection.execute("SELECT value FROM settings WHERE key='sbc:settings'").fetchone() == (fixture,)
        assert connection.execute("SELECT added_at,target_price FROM watchlist WHERE product_id='ENCHANTED_DIAMOND'").fetchone() == (1,42.5)
        print("SQLite integrity and synthetic account/settings/watchlist preserved; not real account validation")
    elif mode == "set":
        connection.execute(
            "INSERT OR REPLACE INTO settings(key, value) VALUES('__smoke_test__', 'preserved')"
        )
        connection.commit()
        print("smoke settings row written")
    else:
        row = connection.execute(
            "SELECT value FROM settings WHERE key='__smoke_test__'"
        ).fetchone()
        if not row or row[0] != "preserved":
            raise SystemExit("user settings did not survive uninstall")
        print("smoke settings row preserved")
