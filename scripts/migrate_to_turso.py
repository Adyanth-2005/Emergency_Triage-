"""
Copy the local SQLite database (with its intact audit hash-chain) into a
Turso / libSQL database, preserving row IDs and provenance.

Usage (from the project root, with libsql installed):

    pip install -r requirements-turso.txt
    export LIBSQL_URL="libsql://<your-db>.turso.io"
    export LIBSQL_AUTH_TOKEN="<token>"        # from: turso db tokens create <db>
    python seed.py                            # optional: ensure local ed.db exists
    python scripts/migrate_to_turso.py

The script drops+recreates the schema on the remote, then copies every table in
foreign-key order. Because the audit triggers only forbid UPDATE/DELETE (not
INSERT), the hash chain transfers verbatim and still verifies remotely.
"""
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from db_backend import _split_sql  # noqa: E402  (reuse the trigger-aware splitter)

LOCAL = os.environ.get("ED_LOCAL_DB", str(ROOT / "ed.db"))
URL = os.environ.get("LIBSQL_URL") or os.environ.get("TURSO_DATABASE_URL")
TOKEN = os.environ.get("LIBSQL_AUTH_TOKEN") or os.environ.get("TURSO_AUTH_TOKEN")

# insert order respects foreign keys
TABLES = ["triage_scale_config", "patient", "ed_encounter", "triage_event",
          "mlc_counter", "mlc_case", "police_intimation", "disposition", "audit_log"]
VIEWS = ["v_tracking_board", "v_override_report"]


def main():
    if not URL:
        sys.exit("Set LIBSQL_URL (and LIBSQL_AUTH_TOKEN). See docs/DEPLOYMENT.md.")
    if not Path(LOCAL).exists():
        sys.exit(f"Local DB not found at {LOCAL}. Run `python seed.py` first.")
    try:
        import libsql_experimental as libsql
    except ImportError:
        sys.exit("libsql not installed. Run: pip install -r requirements-turso.txt")

    remote = libsql.connect(database=URL, auth_token=TOKEN)
    print(f"→ remote: {URL}")

    # drop existing objects, then recreate the schema
    for v in VIEWS:
        remote.execute(f"DROP VIEW IF EXISTS {v}")
    for t in reversed(TABLES):
        remote.execute(f"DROP TABLE IF EXISTS {t}")
    for stmt in _split_sql((ROOT / "schema.sql").read_text()):
        remote.execute(stmt)
    remote.commit()
    print("→ schema created")

    local = sqlite3.connect(LOCAL)
    local.row_factory = sqlite3.Row
    total = 0
    for t in TABLES:
        rows = [dict(r) for r in local.execute(f"SELECT * FROM {t}")]
        if not rows:
            continue
        cols = list(rows[0].keys())
        ph = ",".join(["?"] * len(cols))
        remote.executemany(
            f"INSERT INTO {t} ({','.join(cols)}) VALUES ({ph})",
            [[r[c] for c in cols] for r in rows],
        )
        total += len(rows)
        print(f"   {t:22} {len(rows):>4} rows")
    remote.commit()
    local.close()
    print(f"✓ migrated {total} rows. Deploy with LIBSQL_URL + LIBSQL_AUTH_TOKEN set "
          f"and AI_ENABLED=false.")


if __name__ == "__main__":
    main()
