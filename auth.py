"""
auth.py — session authentication and server-side RBAC.

Closes KNOWN_GAPS B-1. Before this module, `actor` arrived in the request
body: the client told the server who it was, and a crafted curl could write
an audit row under any name it liked. That undermined the one thing the audit
log exists to guarantee — attribution. Now the actor is derived from a signed
server-side session and the request body cannot override it.

ACADEMIC PROTOTYPE — stated plainly rather than hidden:
  - Users are a fixed dict, not a table. No registration, no password reset.
  - Passwords are salted SHA-256. Real deployments use bcrypt/argon2 with a
    per-user salt and a work factor; SHA-256 is fast, which is exactly the
    property an attacker wants. This is a demo credential store, not a
    security control.
  - The session cookie is signed, not encrypted. Fine for a local single-node
    demo; not a claim about production readiness.
"""

import hashlib
import hmac
import os
from functools import wraps

from flask import jsonify, session

# Fixed demo salt. In production this is per-user and never lives in source.
_SALT = "p5-ed-triage-academic-demo"


def _hash(pw: str) -> str:
    return hashlib.sha256((_SALT + pw).encode()).hexdigest()


# ---------------------------------------------------------------------
# Permissions.
#
# These mirror the four PRD-05 §3 personas. `reception` is new — it maps to
# the "Registration desk" persona, which the PRD lists but the UI never had.
# Reception can register a patient and see the board. It cannot triage, cannot
# attend, cannot dispose, and cannot touch a medico-legal case: assigning an
# acuity level or signing an MLC is a clinical and statutory act.
# ---------------------------------------------------------------------
PERMS = {
    "nurse":     {"register", "triage", "view_board", "view_audit"},
    "physician": {"register", "triage", "attend", "dispose", "mlc",
                  "intimation", "view_board", "view_audit"},
    "cmo":       {"register", "mlc", "intimation", "view_board", "view_audit",
                  "view_overrides"},
    "reception": {"register", "view_board"},
    "admin":     {"register", "triage", "attend", "dispose", "mlc", "intimation",
                  "view_board", "view_audit", "view_overrides", "reset_demo"},
}

USERS = {
    "doctor@hospital.com": {
        "pw": _hash("password123"), "key": "physician",
        "name": "Dr. A. Verma", "role": "Physician", "init": "AV",
    },
    "nurse@hospital.com": {
        "pw": _hash("password123"), "key": "nurse",
        "name": "N. Priya", "role": "Triage Nurse", "init": "NP",
    },
    "reception@hospital.com": {
        "pw": _hash("password123"), "key": "reception",
        "name": "R. Iyer", "role": "Receptionist", "init": "RI",
    },
    "admin@hospital.com": {
        "pw": _hash("password123"), "key": "admin",
        "name": "System Admin", "role": "Administrator", "init": "SA",
    },
    # Retained: the CMO persona pre-dates this module and appears in seeded
    # audit rows. Removing it would orphan that history.
    "cmo@hospital.com": {
        "pw": _hash("password123"), "key": "cmo",
        "name": "Dr. S. Menon", "role": "CMO", "init": "SM",
    },
}


def authenticate(email: str, password: str):
    """Return the user dict on success, else None. Constant-time compare."""
    u = USERS.get((email or "").strip().lower())
    if not u:
        # Hash anyway so a missing user and a wrong password take the same
        # time. Otherwise response latency leaks which emails are registered.
        _hash(password or "")
        return None
    if not hmac.compare_digest(u["pw"], _hash(password or "")):
        return None
    return u


def login_user(email: str, u: dict) -> None:
    session.clear()
    session["email"] = email
    session["key"] = u["key"]
    session["name"] = u["name"]
    session["role"] = u["role"]
    session["init"] = u["init"]
    session.permanent = False          # dies with the browser session


def logout_user() -> None:
    session.clear()


def current_user():
    if "email" not in session:
        return None
    return {
        "email": session["email"], "key": session["key"],
        "name": session["name"], "role": session["role"],
        "init": session["init"],
        "perms": sorted(PERMS.get(session["key"], set())),
    }


def actor() -> str:
    """
    The audit actor. Derived from the session — NEVER from the request body.
    This is the whole point of the module.
    """
    if "name" not in session:
        return "system"
    return f"{session['name']} ({session['role']})"


def can(perm: str) -> bool:
    return perm in PERMS.get(session.get("key", ""), set())


# ---------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------
def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if "email" not in session:
            return jsonify({"error": "auth_required",
                            "message": "Sign in to continue."}), 401
        return fn(*a, **kw)
    return wrapper


def requires(perm: str):
    """Server-side RBAC. A 403 here cannot be bypassed by editing the UI."""
    def deco(fn):
        @wraps(fn)
        @login_required
        def wrapper(*a, **kw):
            if not can(perm):
                return jsonify({
                    "error": "forbidden",
                    "message": f"Your role ({session.get('role')}) is not "
                               f"permitted to perform this action.",
                    "required": perm,
                }), 403
            return fn(*a, **kw)
        return wrapper
    return deco


def init_app(flask_app):
    """Signing key. Env var in a real deployment; ephemeral here by design."""
    flask_app.secret_key = os.environ.get("ED_SECRET_KEY") or os.urandom(32)
