"""
test_fr.py — proves the Phase-2/3 Functional Requirements added on top of the
frozen M2 core: injury notes (FR-5), evidence chain-of-custody (FR-6), the
mandatory-reporting engine (FR-7), pre-arrival intake (FR-9), MCI mode (FR-10),
pathway timers (FR-11), cashless entitlement (FR-14) and the rule-based
deterioration watch (AI-3).

Same adversarial spirit as test_auth: everything is exercised through the HTTP
layer with a real session, and RBAC is probed by trying to do the wrong job.
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
    return cl.post("/api/auth/login", json={"email": email, "password": pw})


def new_encounter(cl, **body):
    r = cl.post("/api/quick-reg", json=body)
    return (r.get_json() or {}).get("encounter_id")


def triage(cl, enc, level=3, vitals=None, complaint="chest pain", flags=None):
    return cl.post("/api/triage", json={
        "encounter_id": enc, "chief_complaint": complaint,
        "vitals": vitals or {"gcs": 15}, "red_flags": flags or [],
        "final_level": level, "override_reason": "clinician re-triage decision recorded"})


doc = client()
login(doc, "doctor@hospital.com")
rec = client()
login(rec, "reception@hospital.com")


print("\n=== FR-5. Injury documentation (body-map) ===")
enc = new_encounter(doc, name="Injury Test", age_years=30, sex="M")
triage(doc, enc, complaint="assault, multiple wounds")
r = doc.post(f"/api/encounters/{enc}/injury", json={
    "region": "head_front", "wound_type": "laceration",
    "description": "3cm scalp laceration, actively bleeding"})
check("physician can record an injury note -> 201", r.status_code == 201,
      f"HTTP {r.status_code}")
r = doc.post(f"/api/encounters/{enc}/injury", json={"description": "no region"})
check("injury note without region/type -> 422", r.status_code == 422)
r = rec.post(f"/api/encounters/{enc}/injury", json={
    "region": "arm_left", "wound_type": "abrasion"})
check("receptionist CANNOT record injuries (no triage perm) -> 403",
      r.status_code == 403)
r = doc.get(f"/api/encounters/{enc}")
check("injury appears in encounter read-model",
      len((r.get_json() or {}).get("injuries", [])) == 1)


print("\n=== FR-6. Evidence / chain-of-custody ===")
r = doc.post("/api/mlc", json={"encounter_id": enc, "mlc_type": "ASSAULT"})
mlc_id = (r.get_json() or {}).get("mlc_id")
check("MLC opened for evidence test", bool(mlc_id), f"mlc_id={mlc_id}")
r = doc.post(f"/api/mlc/{mlc_id}/evidence", json={
    "item": "blood-stained shirt", "handed_to": "PC Rao", "handed_badge": "KA-1123",
    "signature_ref": "GD-4471"})
check("physician can log evidence -> 201", r.status_code == 201,
      f"HTTP {r.status_code}")
r = doc.post(f"/api/mlc/{mlc_id}/evidence", json={"description": "no item name"})
check("evidence without item name -> 422", r.status_code == 422)
r = rec.post(f"/api/mlc/{mlc_id}/evidence", json={"item": "x"})
check("receptionist CANNOT log evidence (no mlc perm) -> 403",
      r.status_code == 403)
r = doc.get(f"/api/mlc/{mlc_id}")
check("evidence appears in MLC read-model",
      len((r.get_json() or {}).get("evidence", [])) == 1)


print("\n=== FR-7. Mandatory-reporting engine ===")
enc2 = new_encounter(doc, name="POCSO Test", age_years=12, sex="F")
triage(doc, enc2, complaint="sexual assault")
doc.post("/api/mlc", json={"encounter_id": enc2, "mlc_type": "SEXUAL_OFFENCE_POCSO"})
r = doc.get(f"/api/encounters/{enc2}/reporting")
duties = (r.get_json() or {}).get("duties", [])
pocso = next((d for d in duties if d["code"] == "POCSO"), None)
check("POCSO duty is raised for a POCSO MLC", pocso is not None)
check("POCSO is a HARD (non-dismissible-without-reason) duty",
      bool(pocso and pocso.get("hard")))
r = doc.post(f"/api/encounters/{enc2}/reporting/ack",
             json={"duty": "POCSO", "action": "DISMISSED", "justification": "no"})
check("dismissing a duty with a too-short reason -> 422", r.status_code == 422)
r = doc.post(f"/api/encounters/{enc2}/reporting/ack",
             json={"duty": "POCSO", "action": "REPORTED"})
check("reporting a duty is accepted -> 201", r.status_code == 201)
r = doc.get(f"/api/encounters/{enc2}")
rep = (r.get_json() or {}).get("reporting", {})
check("acted duty no longer shows as pending",
      all(d["code"] != "POCSO" for d in rep.get("pending", [])))


print("\n=== FR-9. Pre-arrival / ambulance intake ===")
r = doc.post("/api/prearrival", json={
    "source": "108", "eta_minutes": 8, "age_years": 55, "sex": "M",
    "complaint": "chest pain, diaphoretic", "code": "STEMI",
    "vitals": {"hr": 110, "sbp": 90}})
pid = (r.get_json() or {}).get("id")
check("ambulance pre-alert logged -> 201", r.status_code == 201)
r = doc.get("/api/prearrival")
board = r.get_json() or []
check("pre-arrival appears on the inbound board",
      any(p["id"] == pid and p["code"] == "STEMI" for p in board))
r = doc.post(f"/api/prearrival/{pid}/close", json={"arrived": True})
check("pre-arrival can be marked ARRIVED",
      (r.get_json() or {}).get("status") == "ARRIVED")


print("\n=== FR-10. MCI / mass-casualty mode ===")
tally0 = (doc.get("/api/mci").get_json() or {}).get("total", 0)
for tag in ("RED", "YELLOW", "GREEN", "BLACK"):
    r = doc.post("/api/mci/register", json={"tag": tag})
    check(f"MCI casualty tagged {tag} -> 201", r.status_code == 201,
          (r.get_json() or {}).get("temp_id"))
r = doc.post("/api/mci/register", json={"tag": "PURPLE"})
check("an invalid triage tag is refused -> 422", r.status_code == 422)
mci = doc.get("/api/mci").get_json() or {}
check("MCI tally counts all four new casualties",
      mci.get("total", 0) - tally0 == 4, f"total={mci.get('total')}")
check("BLACK casualty is recorded as closed",
      any(c["tag"] == "BLACK" and c["status"] == "CLOSED"
          for c in mci.get("casualties", [])))


print("\n=== FR-11. Time-critical pathway timers ===")
r = doc.post(f"/api/encounters/{enc}/timer", json={"kind": "ECG"})
check("door-to-ECG timer stamped -> 200", r.status_code == 200,
      (r.get_json() or {}).get("stamped_at"))
r = doc.post(f"/api/encounters/{enc}/timer", json={"kind": "BOGUS"})
check("an unknown pathway kind is refused -> 422", r.status_code == 422)
r = doc.get(f"/api/encounters/{enc}")
check("timer appears in encounter read-model",
      any(t["kind"] == "ECG" for t in (r.get_json() or {}).get("timers", [])))


print("\n=== FR-14. Cashless / free-treatment entitlement ===")
r = doc.post(f"/api/encounters/{enc}/cashless", json={"scheme": "MV_ACT"})
check("cashless scheme set -> 200", r.status_code == 200)
r = doc.get(f"/api/encounters/{enc}")
check("cashless scheme reflected in read-model",
      (r.get_json() or {}).get("cashless_scheme") == "MV_ACT")


print("\n=== AI-3. Deterioration watch (rule-based, works AI-off) ===")
enc3 = new_encounter(doc, name="Deteriorating Pt", age_years=64, sex="M")
triage(doc, enc3, level=3, vitals={"hr": 80, "rr": 16, "sbp": 120, "spo2": 98, "gcs": 15})
triage(doc, enc3, level=2, vitals={"hr": 118, "rr": 24, "sbp": 96, "spo2": 89, "gcs": 13})
r = doc.get("/api/ai/deterioration")
flagged = (r.get_json() or {}).get("flagged", [])
hit = next((f for f in flagged if f["encounter_id"] == enc3), None)
check("deteriorating patient is flagged", hit is not None)
check("flag explains WHY (vitals trend reasons)",
      bool(hit and len(hit.get("reasons", [])) >= 2),
      ", ".join(hit["reasons"]) if hit else "")


print("\n=== Audit chain still intact after all FR writes ===")
adm = client()
login(adm, "admin@hospital.com")
d = adm.get("/api/audit/verify").get_json() or {}
check("hash chain intact", d.get("chain_intact") is True,
      "every FR write is chained like any other")


print("\n" + "=" * 58)
print(f"  {PASS} passed, {FAIL} failed")
print("=" * 58)
sys.exit(1 if FAIL else 0)
