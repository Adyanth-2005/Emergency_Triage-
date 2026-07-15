"""
test_auth.py — proves authentication and RBAC are enforced on the SERVER.

The point of these tests is adversarial: they try to do the things the UI
prevents, by bypassing the UI entirely. A login screen that only hides buttons
is theatre. These assert the server refuses regardless.

Closes KNOWN_GAPS B-1.
"""
import sqlite3
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DB = HERE / "ed.db"
if DB.exists():
    DB.unlink()
conn = sqlite3.connect(DB)
conn.executescript((HERE / "schema.sql").read_text())
conn.commit()
conn.close()
subprocess.run([sys.executable, str(HERE / "seed.py")],
               capture_output=True, check=True)

import app as A  # noqa: E402

PASS = FAIL = 0


def check(name, cond, note=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}" + (f"  — {note}" if note else ""))
    else:
        FAIL += 1
        print(f"  FAIL  {name}" + (f"  — {note}" if note else ""))


def client():
    return A.app.test_client()


def login(cl, email, pw="password123"):
    return cl.post("/api/auth/login",
                   json={"email": email, "password": pw})


print("\n=== 1. Anonymous access is refused ===")
anon = client()
r = anon.get("/api/board")
check("GET /api/board without a session -> 401", r.status_code == 401,
      f"HTTP {r.status_code}")
r = anon.post("/api/quick-reg", json={})
check("POST /api/quick-reg without a session -> 401", r.status_code == 401,
      f"HTTP {r.status_code}")
r = anon.get("/")
check("GET / redirects to /login", r.status_code == 302
      and "/login" in r.headers.get("Location", ""))
r = anon.get("/api/health")
check("/api/health stays public (liveness probe)", r.status_code == 200)

print("\n=== 2. Bad credentials ===")
cl = client()
r = login(cl, "doctor@hospital.com", "wrongpassword")
check("wrong password -> 401", r.status_code == 401, f"HTTP {r.status_code}")
r = login(cl, "ghost@hospital.com", "password123")
check("unknown user -> 401", r.status_code == 401, f"HTTP {r.status_code}")
check("error message does not reveal whether the email exists",
      (r.get_json() or {}).get("message", "").lower().startswith("incorrect"),
      "same message for both cases")
r = cl.post("/api/auth/login", json={"email": "", "password": ""})
check("empty fields -> 400", r.status_code == 400, f"HTTP {r.status_code}")

print("\n=== 3. Valid login establishes a session ===")
doc = client()
r = login(doc, "doctor@hospital.com")
check("doctor signs in -> 200", r.status_code == 200, f"HTTP {r.status_code}")
u = (r.get_json() or {}).get("user", {})
check("session carries the role", u.get("role") == "Physician",
      u.get("role"))
r = doc.get("/api/board")
check("authenticated read now succeeds", r.status_code == 200)

print("\n=== 4. THE POINT: RBAC is enforced server-side, not in the UI ===")
rec = client()
login(rec, "reception@hospital.com")
r = rec.post("/api/quick-reg", json={})
check("receptionist CAN register (their job)", r.status_code == 201,
      f"HTTP {r.status_code}")
enc = (r.get_json() or {}).get("encounter_id")

r = rec.post("/api/triage", json={
    "encounter_id": enc, "chief_complaint": "x", "vitals": {"gcs": 15},
    "red_flags": [], "final_level": 1, "override_reason": "forced"})
check("receptionist CANNOT triage -> 403", r.status_code == 403,
      "assigning acuity is a clinical act")

r = rec.post("/api/disposition", json={
    "encounter_id": enc, "type": "DISCHARGE", "discharge_instructions": "x"})
check("receptionist CANNOT dispose -> 403", r.status_code == 403)

r = rec.post("/api/mlc", json={"encounter_id": enc, "mlc_type": "RTA"})
check("receptionist CANNOT open an MLC -> 403", r.status_code == 403,
      "an MLC is a statutory record")

r = rec.post("/api/demo/reset")
check("receptionist CANNOT reset the database -> 403", r.status_code == 403)

print("\n=== 5. A forged actor cannot be injected ===")
nurse = client()
login(nurse, "nurse@hospital.com")
r = nurse.post("/api/quick-reg", json={"actor": "Dr. Fake (Chief of Medicine)"})
check("quick-reg accepted", r.status_code == 201)
row = A.db_conn_for_test() if hasattr(A, "db_conn_for_test") else None
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
last = conn.execute(
    "SELECT actor FROM audit_log WHERE action='QUICK_REG' "
    "ORDER BY id DESC LIMIT 1").fetchone()["actor"]
conn.close()
check("audit records the SESSION identity, not the body's claim",
      "N. Priya" in last and "Fake" not in last,
      f"actor = {last!r}")

print("\n=== 6. Logout ends the session ===")
r = nurse.post("/api/auth/logout")
check("logout -> 200", r.status_code == 200)
r = nurse.get("/api/board")
check("board is refused after logout -> 401", r.status_code == 401,
      f"HTTP {r.status_code}")

print("\n=== 7. Login and logout are audited ===")
conn = sqlite3.connect(DB)
n_login = conn.execute(
    "SELECT COUNT(*) FROM audit_log WHERE action='LOGIN'").fetchone()[0]
n_out = conn.execute(
    "SELECT COUNT(*) FROM audit_log WHERE action='LOGOUT'").fetchone()[0]
conn.close()
check("LOGIN rows written", n_login >= 3, f"{n_login} logins")
check("LOGOUT rows written", n_out >= 1, f"{n_out} logouts")

print("\n=== 8. Audit chain survives the new rows ===")
adm = client()
login(adm, "admin@hospital.com")
r = adm.get("/api/audit/verify")
d = r.get_json() or {}
check("hash chain still intact", d.get("chain_intact") is True,
      "auth rows are chained like any other")

print("\n" + "=" * 58)
print(f"  {PASS} passed, {FAIL} failed")
print("=" * 58)
sys.exit(1 if FAIL else 0)
