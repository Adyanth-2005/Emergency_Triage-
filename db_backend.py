"""
Database backend adapter — one seam, two backends.

  * DEFAULT (local / disk):  Python stdlib `sqlite3` against a file. This is the
    path every test exercises and its behaviour is unchanged.
  * OPT-IN (serverless / persistent):  Turso / libSQL over the network, enabled
    only when LIBSQL_URL (or TURSO_DATABASE_URL) is set. A thin wrapper makes the
    libSQL connection quack like a stdlib sqlite3 connection (named-row access,
    a trigger-aware executescript, lastrowid, iterable cursors) so app.py and
    seed.py need no per-call changes.

Turso makes the app genuinely stateful on stateless hosts (Vercel), because the
data lives in a remote libSQL database, not the ephemeral function filesystem.
"""
import os
import re
import sqlite3

LIBSQL_URL = os.environ.get("LIBSQL_URL") or os.environ.get("TURSO_DATABASE_URL")
LIBSQL_TOKEN = os.environ.get("LIBSQL_AUTH_TOKEN") or os.environ.get("TURSO_AUTH_TOKEN")
IS_REMOTE = bool(LIBSQL_URL)


def backend_name():
    return "turso/libsql" if IS_REMOTE else "sqlite"


# --------------------------------------------------------------------- sqlite
def _sqlite_connect(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row          # name + index access, exactly as before
    return conn


# --------------------------------------------------------------- libsql wrapper
class _NamedRow:
    """sqlite3.Row-alike: row["col"] and row[0] both work."""
    __slots__ = ("_v", "_i")

    def __init__(self, values, cols):
        self._v = tuple(values)
        self._i = {c: k for k, c in enumerate(cols)}

    def __getitem__(self, key):
        return self._v[key] if isinstance(key, int) else self._v[self._i[key]]

    def __iter__(self):
        return iter(self._v)

    def __len__(self):
        return len(self._v)

    def keys(self):
        return list(self._i)

    def get(self, key, default=None):
        try:
            return self[key]
        except (KeyError, IndexError):
            return default


def _cols(cur):
    return [d[0] for d in (cur.description or [])]


class _Cur:
    def __init__(self, cur):
        self._c = cur

    @property
    def lastrowid(self):
        return self._c.lastrowid

    @property
    def rowcount(self):
        return getattr(self._c, "rowcount", -1)

    def fetchone(self):
        r = self._c.fetchone()
        return _NamedRow(r, _cols(self._c)) if r is not None else None

    def fetchall(self):
        cols = _cols(self._c)
        return [_NamedRow(r, cols) for r in self._c.fetchall()]

    def __iter__(self):
        cols = _cols(self._c)
        for r in self._c:
            yield _NamedRow(r, cols)


def _split_sql(script):
    """Split a script into statements, respecting trigger BEGIN…END bodies
    (naive ';' splitting would break the append-only audit triggers)."""
    text = "\n".join(re.sub(r"--.*$", "", ln) for ln in script.splitlines())
    stmts, cur = [], ""
    # whole-word counts so "append-only" inside a trigger body is NOT read as END
    n = lambda w, s: len(re.findall(r"\b" + w + r"\b", s.upper()))
    for part in re.split(r"(;)", text):
        cur += part
        if part == ";" and n("BEGIN", cur) <= n("END", cur):
            s = cur.strip().rstrip(";").strip()
            if s:
                stmts.append(s)
            cur = ""
    if cur.strip():
        stmts.append(cur.strip())
    return stmts


class _Conn:
    """Minimal sqlite3.Connection surface over a libSQL connection."""
    def __init__(self, raw):
        self._raw = raw
        self.row_factory = None  # accepted but ignored; rows are always named

    def execute(self, sql, params=()):
        return _Cur(self._raw.execute(sql, params))

    def executemany(self, sql, seq):
        return _Cur(self._raw.executemany(sql, list(seq)))

    def executescript(self, script):
        for stmt in _split_sql(script):
            self._raw.execute(stmt)
        self.commit()
        return self

    def commit(self):
        self._raw.commit()

    def close(self):
        try:
            self._raw.close()
        except Exception:
            pass


def _libsql_connect():
    import libsql_experimental as libsql  # optional dep; see requirements-turso.txt
    raw = libsql.connect(database=LIBSQL_URL, auth_token=LIBSQL_TOKEN)
    return _Conn(raw)


# --------------------------------------------------------------------- public
def connect(path):
    """Return a connection. Local file (stdlib sqlite3) unless LIBSQL_URL is set."""
    return _libsql_connect() if IS_REMOTE else _sqlite_connect(path)
