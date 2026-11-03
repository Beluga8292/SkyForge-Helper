"""Write and verify a settings row for the Windows uninstall smoke test."""
from pathlib import Path
import sqlite3
import sys

if len(sys.argv) != 3 or sys.argv[1] not in {"set", "get"}:
    raise SystemExit("usage: windows-smoke-sqlite.py set|get <database>")
mode, database = sys.argv[1], Path(sys.argv[2])
if not database.is_file():
    raise SystemExit(f"database not found: {database}")

with sqlite3.connect(database) as connection:
    if mode == "set":
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
