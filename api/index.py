"""
Vercel serverless entry (Python runtime) — READ-ONLY DEMO mode.

Vercel functions are stateless and have a read-only filesystem except /tmp,
which is wiped between cold starts. This project's audit chain and live writes
need a PERSISTENT database, so on Vercel we run a demo: the deterministic seed
is built into /tmp on cold start, AI is disabled, and writes do not persist.

For the real stateful app (persistent audit chain), deploy to a host with a
disk/volume — Render, Railway, or Fly.io — or migrate SQLite to Turso/Postgres.
See docs/DEPLOYMENT.md.
"""
import os
import sys
from pathlib import Path

# make the project root importable and force the serverless-safe config
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("ED_DB_PATH", "/tmp/ed.db")     # only writable path
os.environ.setdefault("AI_ENABLED", "false")          # no Ollama on Vercel
# Stable session key so demo logins survive cold starts. This is a DEMO key for
# synthetic data only — set a real ED_SECRET_KEY in Vercel env for anything else.
os.environ.setdefault("ED_SECRET_KEY", "vercel-demo-session-key-synthetic-data-only")

# seed the ephemeral demo DB on cold start if it isn't there yet
if not Path(os.environ["ED_DB_PATH"]).exists():
    try:
        import seed
        seed.build()
    except Exception:  # never let seeding crash the function boot
        pass

from app import app  # noqa: E402  (Flask WSGI callable Vercel serves)
