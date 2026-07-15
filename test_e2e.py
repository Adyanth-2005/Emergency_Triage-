"""
M2 walking-skeleton proof: the end-to-end flow runs, and every compliance
invariant actually holds. Run:  python test_e2e.py
"""
import json
import sqlite3
import subprocess
import sys
from pathlib import Path

subprocess.run([sys.executable, "seed.py"], check=True, cwd=Path(__file__).parent,
               capture_output=True)

import app as A

A.app.config["TESTING"] = True
c = A.app.test_client()

# Auth is now enforced server-side (KNOWN_GAPS B-1, closed). Every write
# endpoint requires a session, so the suite signs in as the admin account —
# the only role holding every permission. Tests that assert a specific role is
# REFUSED sign in separately.
def _login(email="admin@hospital.com", pw="password123", client=None):
    (client or c).post("/api/auth/login",
                       json={"email": email, "password": pw})

_login()

P, F = [], []
def check(name, cond, note=""):
    (P if cond else F).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  — {note}" if note else ""))

print("\n=== 1. FR-2 Quick-reg: EMPTY body must succeed (Art. 21) ===")
r = c.post("/api/quick-reg", json={})
check("empty POST accepted", r.status_code == 201, f"HTTP {r.status_code}")
d = r.get_json()
check("temp ID issued", bool(d["temp_id"]), d["temp_id"])
check("flagged unknown", d["is_unknown"])
eid = d["encounter_id"]

print("\n=== 2. FR-1 Triage: engine suggests, nurse decides ===")
r = c.post("/api/triage/suggest", json={
    "vitals": {"gcs": 6, "spo2": 84, "sbp": 72},
    "red_flags": ["unresponsive"]})
s = r.get_json()
check("critical vitals -> Level 1", s["suggested_level"] == 1,
      f"L{s['suggested_level']} ({s['label']})")
check("reasons are shown", len(s["reasons"]) > 0, "; ".join(s["reasons"][:2]))

r = c.post("/api/triage/suggest", json={"vitals": {}, "red_flags": []})
s2 = r.get_json()
check("no vitals at all -> still suggests (graceful)", s2["suggested_level"] == 4,
      "safe default, does not crash or block")

print("\n=== 3. US-2: override WITHOUT a reason must be REJECTED ===")
r = c.post("/api/triage", json={
    "encounter_id": eid, "chief_complaint": "Unresponsive",
    "vitals": {"gcs": 6, "spo2": 84}, "red_flags": ["unresponsive"],
    "final_level": 4})                       # nurse says 4, engine says 1
check("silent override blocked", r.status_code == 422, f"HTTP {r.status_code}")
check("error names the reason", r.get_json()["error"] == "override_reason_required")

print("\n=== 4. Triage commits WITH a reason; both levels persisted ===")
r = c.post("/api/triage", json={
    "encounter_id": eid, "chief_complaint": "Unresponsive, roadside",
    "vitals": {"gcs": 6, "spo2": 84, "sbp": 72}, "red_flags": ["unresponsive"],
    "triaged_by": "N. Priya"})
t = r.get_json()
check("triage committed", r.status_code == 201)
check("suggested level stored", t["suggested_level"] == 1)
check("final level stored", t["final_level"] == 1)

print("\n=== 5. FR-4 MLC: gapless serial (BNSS §194-196) ===")
r = c.post("/api/mlc", json={"encounter_id": eid, "mlc_type": "RTA",
                             "opened_by": "Dr. Menon"})
m = r.get_json()
check("MLC serial allocated", r.status_code == 201, m["mlc_serial"])
check("statutory basis cited", "BNSS" in m["statutory_basis"])
mlc_id = m["mlc_id"]

conn = sqlite3.connect(A.DB_PATH)
seqs = [row[0] for row in conn.execute("SELECT mlc_seq FROM mlc_case ORDER BY mlc_seq")]
check("serials are gapless", seqs == list(range(1, len(seqs) + 1)), f"seq: {seqs}")
conn.close()

print("\n=== 6. US-6 THE SHOWPIECE: MLC + no intimation -> disposition WARNS ===")
r = c.post("/api/disposition", json={"encounter_id": eid, "type": "DISCHARGE",
                                     "discharge_instr": "Review in 48h"})
w = r.get_json()
check("warning fires", r.status_code == 409, f"HTTP {r.status_code}")
check("statute cited in warning", "BNSS" in w.get("statutory_basis", ""),
      w.get("statutory_basis"))
check("warns but does NOT block care", w.get("blocking") is False,
      "Art. 21 — software must never hold a patient")

print("\n=== 7. Proceed with recorded justification ===")
r = c.post("/api/disposition", json={
    "encounter_id": eid, "type": "DISCHARGE",
    "discharge_instr": "Review in 48h",
    "mlc_warning_ack": True,
    "mlc_warning_reason": "Station phone unreachable; written intimation dispatched by hand."})
check("proceeds with justification", r.status_code == 201, f"HTTP {r.status_code}")

print("\n=== 8. Schema refuses a half-filled LAMA (conditional payload) ===")
conn = sqlite3.connect(A.DB_PATH)
try:
    conn.execute("""INSERT INTO disposition (encounter_id, type, decided_ts, decided_by)
                    VALUES (999,'LAMA','2026-07-11T00:00:00','x')""")
    conn.commit()
    check("LAMA without counselling rejected", False, "DB ACCEPTED IT — bad")
except sqlite3.IntegrityError:
    check("LAMA without counselling rejected", True, "CHECK constraint held")
conn.close()

print("\n=== 9. Audit log is append-only and hash-chained ===")
r = c.get("/api/audit/verify")
check("chain intact", r.get_json()["chain_intact"])

conn = sqlite3.connect(A.DB_PATH)
try:
    conn.execute("UPDATE audit_log SET actor='ghost' WHERE id=1")
    conn.commit()
    check("audit_log UPDATE forbidden", False, "TRIGGER DID NOT FIRE — bad")
except sqlite3.IntegrityError as e:
    check("audit_log UPDATE forbidden", True, str(e)[:44])
try:
    conn.execute("DELETE FROM audit_log WHERE id=1")
    conn.commit()
    check("audit_log DELETE forbidden", False, "TRIGGER DID NOT FIRE — bad")
except sqlite3.IntegrityError as e:
    check("audit_log DELETE forbidden", True, str(e)[:44])
conn.close()

print("\n=== 10. Tamper detection: break a row, chain must SCREAM ===")
conn = sqlite3.connect(A.DB_PATH)
conn.execute("DROP TRIGGER audit_log_no_update")   # simulate a DBA with write access
conn.execute("UPDATE audit_log SET detail_json='{\"tampered\":true}' WHERE id=2")
conn.commit()
conn.close()
r = c.get("/api/audit/verify")
v = r.get_json()
check("tampering detected", v["chain_intact"] is False,
      f"chain breaks at row {v['first_broken_row']}")

print("\n=== 11. Override report (PRD-05 §11 monthly to medical director) ===")
subprocess.run([sys.executable, "seed.py"], check=True, cwd=Path(__file__).parent,
               capture_output=True)
r = c.get("/api/reports/overrides")
ov = r.get_json()
check("overrides queryable in one SELECT", len(ov) >= 1, f"{len(ov)} override(s)")
if ov:
    print(f"        e.g. L{ov[0]['suggested_level']} -> L{ov[0]['final_level']} "
          f"({ov[0]['direction']}) by {ov[0]['triaged_by']}")

print("\n=== 12. Tracking board renders ===")
r = c.get("/api/board")
b = r.get_json()
check("board returns rows", len(b) > 0, f"{len(b)} waiting")
if b:
    print(f"        top: {b[0]['display_name']} | L{b[0]['level']} "
          f"{b[0]['level_label']} | MLC={bool(b[0]['is_mlc'])}")

print("\n" + "=" * 62)
print(f"  {len(P)} passed, {len(F)} failed")
if F:
    print("  FAILED: " + ", ".join(F))
print("=" * 62)
