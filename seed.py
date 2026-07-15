"""
P5 — deterministic seed. Course rule: "deterministically seeded demo data"
and "Use synthetic patients only; no real personal data anywhere in repos".

Every patient below is invented. Seeded with a fixed RNG so the demo is
identical on every machine — a demo that renders differently on the
examiner's laptop than on yours is a demo you cannot rehearse.

    python seed.py        # builds ed.db from scratch
"""

import hashlib
import json
import os
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import triage_rules

random.seed(20260711)  # sprint start date. Fixed. Never change.

HERE = Path(__file__).parent
DB = Path(os.environ.get("ED_DB_PATH", str(HERE / "ed.db")))  # /tmp on serverless
SCHEMA = HERE / "schema.sql"

GENESIS = "0" * 64
_chain = {"prev": GENESIS}


def iso(dt):
    return dt.isoformat(timespec="seconds")


def audit(conn, ts, actor, action, entity, entity_id, detail=None):
    """
    Seed the hash chain exactly the way app.audit() does, so the audit
    viewer and chain verifier have real, verifiable content on first login
    (M2 §5). Uses seeded timestamps kept in insertion order for determinism.
    """
    payload = {"ts": ts, "actor": actor, "action": action,
               "entity": entity, "entity_id": entity_id, "detail": detail or {}}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    row_hash = hashlib.sha256((_chain["prev"] + canonical).encode()).hexdigest()
    conn.execute(
        """INSERT INTO audit_log
           (ts, actor, action, entity, entity_id, detail_json, prev_hash, row_hash)
           VALUES (?,?,?,?,?,?,?,?)""",
        (ts, actor, action, entity, entity_id,
         json.dumps(detail or {}, sort_keys=True), _chain["prev"], row_hash),
    )
    _chain["prev"] = row_hash
    return row_hash


def build():
    import db_backend
    if not db_backend.IS_REMOTE and DB.exists():
        DB.unlink()

    conn = db_backend.connect(str(DB))
    conn.executescript(SCHEMA.read_text())
    try:
        conn.execute("PRAGMA foreign_keys = ON")
    except sqlite3.Error:
        pass

    # --- FR-1: the configurable scale ---------------------------------
    conn.executemany(
        """INSERT INTO triage_scale_config
           (scale_name, level, label, colour, max_wait_minutes, criteria_json, active)
           VALUES (?,?,?,?,?,?,?)""",
        triage_rules.seed_rows(),
    )

    base = datetime.now(timezone.utc) - timedelta(hours=3)

    # Synthetic patients, chosen to exercise every demo branch.
    # Names are common Indian names used as obvious placeholders.
    people = [
        # (name, age, sex, unknown?, complaint, vitals, red_flags, mode, mlc_type)
        ("Ramesh Kumar", 54, "M", False, "Crushing chest pain, radiating to left arm",
         {"hr": 118, "rr": 26, "sbp": 96, "dbp": 60, "spo2": 93, "temp_c": 36.8, "gcs": 15},
         ["chest_pain_ischaemic"], "AMBULANCE_108", None),

        (None, None, None, True, "Unresponsive, found at roadside — RTA",
         {"hr": 132, "rr": 8, "sbp": 74, "spo2": 86, "gcs": 6},
         ["unresponsive", "major_trauma"], "GOOD_SAMARITAN", "RTA"),

        ("Lakshmi Devi", 31, "F", False, "Laceration to left forearm, kitchen knife",
         {"hr": 88, "rr": 16, "sbp": 118, "dbp": 76, "spo2": 99, "temp_c": 37.0, "gcs": 15},
         ["simple_laceration"], "WALK_IN", None),

        ("Arun Prasad", 22, "M", False, "Assault — blunt injury to head, alleged",
         {"hr": 102, "rr": 20, "sbp": 128, "dbp": 82, "spo2": 97, "temp_c": 37.2, "gcs": 14},
         ["moderate_trauma"], "POLICE", "ASSAULT"),

        ("Meena Rajan", 67, "F", False, "Sudden weakness right side, slurred speech",
         {"hr": 92, "rr": 18, "sbp": 168, "dbp": 94, "spo2": 95, "temp_c": 36.9, "gcs": 13},
         ["stroke_fast_positive"], "AMBULANCE_PRIVATE", None),

        ("Suresh Iyer", 45, "M", False, "Dressing change, healing burn",
         {"hr": 76, "rr": 14, "sbp": 122, "dbp": 78, "spo2": 99, "temp_c": 36.6, "gcs": 15},
         ["dressing_change"], "WALK_IN", None),
    ]

    year = datetime.now(timezone.utc).year
    tmp_n = 0
    mlc_seq = 0

    # M3 read-model fodder. Door-to-doctor stamps (encounter index -> minutes
    # after arrival) drive the KPI + board; a couple of dispositions populate
    # the disposition mix and give the register a CLOSED row to point at.
    attend_min = {0: 8, 1: 4, 3: 15}
    dispositions = {
        5: ("DISCHARGE", {
            "discharge_instr": ("Wound redressed under aseptic technique; oral "
                                "co-amoxiclav started; review in 48h or sooner "
                                "if spreading redness, fever, or discharge.")}),
    }

    for i, (name, age, sex, unknown, complaint, vitals, flags, mode, mlc_type) in enumerate(people):
        arrival = base + timedelta(minutes=i * 17)

        temp_id = None
        uhid = None
        if unknown:
            tmp_n += 1
            temp_id = f"TMP-{year}-{tmp_n:04d}"
        else:
            uhid = f"UH{year}{i + 1:05d}"

        cur = conn.execute(
            """INSERT INTO patient
               (uhid, temp_id, name, age_years, sex, phone, is_unknown, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (uhid, temp_id, name, age, sex, None, 1 if unknown else 0, iso(arrival)),
        )
        pid = cur.lastrowid

        cur = conn.execute(
            """INSERT INTO ed_encounter
               (patient_id, arrival_ts, arrival_mode, brought_by, is_mlc, status)
               VALUES (?,?,?,?,?, 'TRIAGED')""",
            (pid, iso(arrival), mode,
             "Bystander — details declined" if mode == "GOOD_SAMARITAN" else None,
             1 if mlc_type else 0),
        )
        eid = cur.lastrowid
        audit(conn, iso(arrival), "N. Priya (Triage Nurse)", "QUICK_REG",
              "ed_encounter", eid, {"is_unknown": bool(unknown), "temp_id": temp_id})

        # Run the real engine — the seed data and the demo agree by construction.
        res = triage_rules.evaluate(vitals=vitals, red_flags=flags)
        suggested = res["suggested_level"]
        final = suggested
        reason = None

        # One deliberate override, so the override report has something in it
        # and the VIP-pressure conversation has a concrete example to point at.
        if name == "Suresh Iyer":
            final = 4
            suggested = 5
            reason = "Patient is immunosuppressed; wound appears infected on inspection."

        cur = conn.execute(
            """INSERT INTO triage_event
               (encounter_id, triaged_ts, chief_complaint, hr, rr, sbp, dbp,
                spo2, temp_c, gcs, red_flags_json, suggested_level, final_level,
                override_reason, triaged_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (eid, iso(arrival + timedelta(minutes=3)), complaint,
             vitals.get("hr"), vitals.get("rr"), vitals.get("sbp"), vitals.get("dbp"),
             vitals.get("spo2"), vitals.get("temp_c"), vitals.get("gcs"),
             json.dumps(flags), suggested, final, reason, "N. Priya (Triage Nurse)"),
        )
        triage_id = cur.lastrowid
        if final != suggested:
            audit(conn, iso(arrival + timedelta(minutes=3)), "N. Priya (Triage Nurse)",
                  "TRIAGE_OVERRIDE", "triage_event", triage_id,
                  {"suggested": suggested, "final": final, "reason": reason,
                   "direction": "DOWNGRADED" if final > suggested else "UPGRADED"})
        else:
            audit(conn, iso(arrival + timedelta(minutes=3)), "N. Priya (Triage Nurse)",
                  "TRIAGE", "triage_event", triage_id, {"level": final})

        if mlc_type:
            mlc_seq += 1
            serial = f"MLC/{year}/{mlc_seq:04d}"
            conn.execute(
                "INSERT INTO mlc_counter(year, last_seq) VALUES (?,?) "
                "ON CONFLICT(year) DO UPDATE SET last_seq=?",
                (year, mlc_seq, mlc_seq),
            )
            cur = conn.execute(
                """INSERT INTO mlc_case
                   (encounter_id, mlc_serial, mlc_year, mlc_seq, mlc_type,
                    pocso_flag, opened_ts, opened_by)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (eid, serial, year, mlc_seq, mlc_type, 0,
                 iso(arrival + timedelta(minutes=5)), "Dr. S. Menon (CMO)"),
            )
            mlc_id = cur.lastrowid
            audit(conn, iso(arrival + timedelta(minutes=5)), "Dr. S. Menon (CMO)",
                  "MLC_OPEN", "mlc_case", mlc_id,
                  {"serial": serial, "type": mlc_type, "pocso": False})

            # The ASSAULT case gets its intimation logged. The RTA case does
            # NOT — deliberately. That pending intimation is what makes the
            # US-6 warning fire live in the M4 demo instead of being described.
            if mlc_type == "ASSAULT":
                cur = conn.execute(
                    """INSERT INTO police_intimation
                       (mlc_case_id, intimated_ts, police_station, constable_name,
                        constable_badge, mode, ack_ref, logged_by)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (mlc_id, iso(arrival + timedelta(minutes=12)),
                     "Adyar Police Station", "Constable R. Ramesh", "TN-4471",
                     "PHONE", None, "Dr. S. Menon (CMO)"),
                )
                audit(conn, iso(arrival + timedelta(minutes=12)), "Dr. S. Menon (CMO)",
                      "INTIMATION_LOG", "police_intimation", cur.lastrowid,
                      {"mlc_case_id": mlc_id, "mode": "PHONE"})

        # Door-to-doctor: physician attended -> IN_TREATMENT + stamp.
        if i in attend_min:
            phys_at = iso(arrival + timedelta(minutes=attend_min[i]))
            conn.execute(
                """UPDATE ed_encounter
                   SET status='IN_TREATMENT', first_physician_at=?, attended_by=?
                   WHERE id=?""",
                (phys_at, "Dr. A. Verma (EP)", eid),
            )
            audit(conn, phys_at, "Dr. A. Verma (EP)", "PHYSICIAN_ATTEND",
                  "ed_encounter", eid, {"door_to_doctor_at": phys_at})

        # A closed encounter so the disposition mix + register have content.
        if i in dispositions:
            dtype, fields = dispositions[i]
            phys_at = iso(arrival + timedelta(minutes=6))
            closed = iso(arrival + timedelta(minutes=40))
            conn.execute(
                """UPDATE ed_encounter
                   SET status='CLOSED', closed_ts=?,
                       first_physician_at=COALESCE(first_physician_at, ?),
                       attended_by=COALESCE(attended_by, ?)
                   WHERE id=?""",
                (closed, phys_at, "Dr. A. Verma (EP)", eid),
            )
            conn.execute(
                """INSERT INTO disposition
                   (encounter_id, type, decided_ts, decided_by, discharge_instr)
                   VALUES (?,?,?,?,?)""",
                (eid, dtype, closed, "Dr. A. Verma (EP)",
                 fields.get("discharge_instr")),
            )
            audit(conn, closed, "Dr. A. Verma (EP)", "DISPOSITION",
                  "ed_encounter", eid, {"type": dtype, "mlc_warning_ack": False})

    conn.commit()
    conn.close()
    print(f"Seeded {DB}")
    print(f"  patients:     {len(people)}")
    print(f"  MLC cases:    {mlc_seq}")
    print(f"  intimations:  1 logged, 1 PENDING (the RTA — demo fodder for US-6)")


if __name__ == "__main__":
    build()
