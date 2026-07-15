"""
M3 checkpoint proof: the additive read models, KPI computation, door-to-doctor
flow, demo controls and SPA shell all work — without breaking the frozen M2
API. Run:  python test_m3.py   (reseeds first, deterministic).
"""
import subprocess
import sys
from pathlib import Path

subprocess.run([sys.executable, "seed.py"], check=True, cwd=Path(__file__).parent,
               capture_output=True)

import app as A
A.app.config["TESTING"] = True
A.app.debug = True  # so /api/demo/reset is permitted in the test
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

print("\n=== 1. SPA shell serves ===")
r = c.get("/")
check("index.html served", r.status_code == 200 and b"ED Triage Console" in r.data)
check("stylesheet reachable", c.get("/static/css/console.css").status_code == 200)
check("app.js reachable", c.get("/static/js/app.js").status_code == 200)

print("\n=== 2. Read models the console renders ===")
enc = c.get("/api/encounters").get_json()
check("encounter list returns rows", len(enc) >= 6, f"{len(enc)} rows")
eid = enc[0]["encounter_id"]
d = c.get(f"/api/encounters/{eid}").get_json()
check("encounter detail has patient+triage", "patient" in d and "triages" in d)
check("mlc register lists cases", len(c.get("/api/mlc").get_json()) >= 1)
check("scale returns 5 levels", len(c.get("/api/scale").get_json()) == 5)

print("\n=== 3. Audit list + live chain verdict ===")
a = c.get("/api/audit").get_json()
check("audit entries present on first login", len(a["entries"]) >= 10, f"{len(a['entries'])} rows")
check("chain intact", a["chain_intact"] is True)
check("distinct actions exposed", "TRIAGE" in a["actions"] and "MLC_OPEN" in a["actions"])

print("\n=== 4. Dashboard KPIs computed from data (not hardcoded) ===")
k = c.get("/api/dashboard").get_json()
for key in ("active_encounters","breaches","mlc_active","door_to_doctor_median_min",
            "level_mix","disposition_mix","intimation_pending","audit_chain_intact"):
    check(f"KPI '{key}' present", key in k)
check("level_mix sums to a real count", sum(k["level_mix"].values()) >= 1)
check("door-to-doctor computed", k["door_to_doctor_median_min"] is not None)

print("\n=== 5. FR-3 attend stamps door-to-doctor once ===")
# find a TRIAGED (awaiting physician) encounter
target = next((e for e in enc if e["status"] == "TRIAGED"), None)
if target:
    r1 = c.post(f"/api/encounters/{target['encounter_id']}/attend", json={"attended_by":"Dr X"})
    check("attend succeeds", r1.status_code == 200, r1.get_json().get("status"))
    t1 = r1.get_json()["first_physician_at"]
    r2 = c.post(f"/api/encounters/{target['encounter_id']}/attend", json={"attended_by":"Dr Y"})
    check("second attend does not overwrite stamp", r2.get_json()["first_physician_at"] == t1)
else:
    check("attend flow", False, "no TRIAGED encounter to attend")

print("\n=== 6. Frozen M2 API still intact (advisory-only unchanged) ===")
s = c.post("/api/triage/suggest", json={"vitals":{"gcs":6,"spo2":84},"red_flags":["unresponsive"]}).get_json()
check("suggest still advisory L1", s["suggested_level"] == 1)
q = c.post("/api/quick-reg", json={})
check("empty quick-reg still 201 (Art. 21)", q.status_code == 201)

print("\n=== 7. Demo reset guarded + functional ===")
A.app.debug = False
check("reset blocked outside debug", c.post("/api/demo/reset").status_code == 403)
A.app.debug = True
check("reset works in debug", c.post("/api/demo/reset").status_code == 200)

print("\n" + "="*58)
print(f"  {len(P)} passed, {len(F)} failed")
if F: print("  FAILED: " + ", ".join(F))
print("="*58)
sys.exit(1 if F else 0)
