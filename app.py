"""
P5 — Emergency Triage: walking skeleton (M2 deliverable).

"App boots, 1 end-to-end flow stubbed" is the M2 bar. This clears it:
the unknown-patient -> triage -> MLC -> intimation -> disposition path
runs end to end. Screens are M3 work; the routes and the invariants are
frozen here.

Run:  python app.py   ->  http://127.0.0.1:5000
"""

import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from flask import (Flask, g, jsonify, redirect, render_template, request,
                   send_from_directory, session)

import auth
import db_backend
import reporting
import triage_rules

HERE = Path(__file__).parent
# DB path is env-configurable so serverless hosts (Vercel) can point it at the
# only writable location, /tmp. On a normal host it stays alongside the code.
DB_PATH = Path(os.environ.get("ED_DB_PATH", str(HERE / "ed.db")))
SCHEMA_PATH = HERE / "schema.sql"
app = Flask(__name__, template_folder="templates", static_folder="static")
auth.init_app(app)


# ---------------------------------------------------------------------
# DB plumbing
# ---------------------------------------------------------------------
def _ensure_schema(conn):
    """
    Self-heal an empty or 0-byte database. If the core tables are absent — the
    exact state that ships as a 0-byte ed.db, or that you get on a fresh clone
    before running seed.py — create the whole schema from schema.sql. This is
    idempotent (it only fires when `audit_log` is missing) and it stops the
    login route from 500-ing on a table-less database.
    """
    have = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'"
    ).fetchone()
    if not have:
        conn.executescript(SCHEMA_PATH.read_text())
        conn.commit()


def _ensure_columns(conn):
    """
    Additive, idempotent migration. M2 froze `ed_encounter` without a
    door-to-doctor stamp; M3's tracking board and KPI tiles need one. We add
    it with ALTER TABLE ... ADD COLUMN, which never rewrites or drops data —
    the completed M2 database keeps every row it already had.
    """
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(ed_encounter)")}
    if "first_physician_at" not in cols:
        conn.execute("ALTER TABLE ed_encounter ADD COLUMN first_physician_at TEXT")
    if "attended_by" not in cols:
        conn.execute("ALTER TABLE ed_encounter ADD COLUMN attended_by TEXT")
    if "bay" not in cols:
        conn.execute("ALTER TABLE ed_encounter ADD COLUMN bay TEXT")               # FR-3
    if "cashless_scheme" not in cols:
        conn.execute("ALTER TABLE ed_encounter ADD COLUMN cashless_scheme TEXT")   # FR-14
    if "mci_tag" not in cols:
        conn.execute("ALTER TABLE ed_encounter ADD COLUMN mci_tag TEXT")           # FR-10
    # FR-5/6/7/9/11 tables — idempotent so existing databases get them without a reseed.
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS injury_note(id INTEGER PRIMARY KEY AUTOINCREMENT,
            encounter_id INTEGER NOT NULL REFERENCES ed_encounter(id), region TEXT NOT NULL,
            wound_type TEXT NOT NULL, description TEXT, photo_consent TEXT, photo_ref TEXT,
            recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS evidence_item(id INTEGER PRIMARY KEY AUTOINCREMENT,
            mlc_case_id INTEGER NOT NULL REFERENCES mlc_case(id), item TEXT NOT NULL,
            description TEXT, collected_by TEXT NOT NULL, handed_to TEXT, handed_badge TEXT,
            signature_ref TEXT, recorded_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reporting_ack(id INTEGER PRIMARY KEY AUTOINCREMENT,
            encounter_id INTEGER NOT NULL REFERENCES ed_encounter(id), duty TEXT NOT NULL,
            action TEXT NOT NULL, justification TEXT, acted_by TEXT NOT NULL, acted_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS prearrival(id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
            eta_minutes INTEGER, age_years INTEGER, sex TEXT, complaint TEXT, vitals_json TEXT,
            code TEXT, status TEXT NOT NULL DEFAULT 'INBOUND', encounter_id INTEGER REFERENCES ed_encounter(id),
            logged_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pathway_timer(id INTEGER PRIMARY KEY AUTOINCREMENT,
            encounter_id INTEGER NOT NULL REFERENCES ed_encounter(id), kind TEXT NOT NULL,
            stamped_at TEXT NOT NULL, stamped_by TEXT NOT NULL, UNIQUE(encounter_id, kind));
    """)
    conn.commit()


def db():
    if "db" not in g:
        # sqlite (local/disk) by default; Turso/libSQL when LIBSQL_URL is set.
        g.db = db_backend.connect(str(DB_PATH))
        try:
            g.db.execute("PRAGMA foreign_keys = ON")
        except sqlite3.Error:
            pass
        _ensure_schema(g.db)     # create tables if the DB is empty/0-byte
        _ensure_columns(g.db)
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def now():
    """
    Server-side UTC, always. Client clocks are never trusted.

    PRD-05 §7: "Every timestamp medico-legally defensible (NTP-synced
    clocks)". A timestamp a court will accept cannot come from a tablet
    whose owner can change the date in Settings.
    """
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------
# Hash-chained audit log — PRD-05 §7 "MLC records tamper-evident"
# ---------------------------------------------------------------------
GENESIS = "0" * 64


def audit(conn, actor, action, entity, entity_id, detail=None):
    """
    Append one link to the chain.

    row_hash = SHA256(prev_hash || canonical_json(payload))

    Editing any historical row breaks every hash after it. That is the
    whole trick — we cannot stop a DBA with write access from altering a
    row, but we can guarantee that doing so is *detectable*, which is
    what "tamper-evident" means and all it has ever meant.
    """
    prev = conn.execute(
        "SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1"
    ).fetchone()
    prev_hash = prev["row_hash"] if prev else GENESIS

    payload = {
        "ts": now(),
        "actor": actor,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "detail": detail or {},
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    row_hash = hashlib.sha256((prev_hash + canonical).encode()).hexdigest()

    conn.execute(
        """INSERT INTO audit_log
           (ts, actor, action, entity, entity_id, detail_json, prev_hash, row_hash)
           VALUES (?,?,?,?,?,?,?,?)""",
        (payload["ts"], actor, action, entity, entity_id,
         json.dumps(payload["detail"], sort_keys=True), prev_hash, row_hash),
    )
    return row_hash


def verify_chain(conn):
    """Recompute every link. Returns (ok, first_broken_id_or_None)."""
    prev_hash = GENESIS
    for row in conn.execute("SELECT * FROM audit_log ORDER BY id"):
        payload = {
            "ts": row["ts"],
            "actor": row["actor"],
            "action": row["action"],
            "entity": row["entity"],
            "entity_id": row["entity_id"],
            "detail": json.loads(row["detail_json"]),
        }
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        expect = hashlib.sha256((prev_hash + canonical).encode()).hexdigest()
        if expect != row["row_hash"] or row["prev_hash"] != prev_hash:
            return False, row["id"]
        prev_hash = row["row_hash"]
    return True, None


# ---------------------------------------------------------------------
# Gapless MLC serial allocation — BNSS 2023 §194-196
# ---------------------------------------------------------------------
def next_mlc_serial(conn, year):
    """
    Allocate the next MLC serial. Gapless, atomic, never reused.

    A statutory register with a hole in it invites exactly one question in
    court: what was in entry 0043, and who removed it? So the counter is a
    single atomic UPDATE inside the caller's transaction rather than a racy
    SELECT MAX(seq)+1. Two nurses triaging simultaneously at 3 a.m. cannot
    collide, and a rolled-back encounter cannot burn a serial.
    """
    conn.execute(
        "INSERT INTO mlc_counter(year, last_seq) VALUES (?, 0) "
        "ON CONFLICT(year) DO NOTHING",
        (year,),
    )
    conn.execute(
        "UPDATE mlc_counter SET last_seq = last_seq + 1 WHERE year = ?", (year,)
    )
    seq = conn.execute(
        "SELECT last_seq FROM mlc_counter WHERE year = ?", (year,)
    ).fetchone()["last_seq"]
    return f"MLC/{year}/{seq:04d}", seq


# =====================================================================
# ROUTES
# =====================================================================

# ---------------------------------------------------------------------
# Authentication (closes KNOWN_GAPS B-1)
# ---------------------------------------------------------------------
@app.get("/login")
def login_page():
    if auth.current_user():
        return redirect("/")
    return render_template("login.html")


@app.post("/api/auth/login")
def api_login():
    body = request.get_json(silent=True) or {}
    email = body.get("email", "")
    pw = body.get("password", "")
    if not email or not pw:
        return jsonify({"error": "missing_fields",
                        "message": "Enter both your email and password."}), 400

    u = auth.authenticate(email, pw)
    if not u:
        # One message for both cases. Saying "no such user" would confirm which
        # addresses exist.
        return jsonify({"error": "invalid_credentials",
                        "message": "Incorrect email or password."}), 401

    auth.login_user(email.strip().lower(), u)
    conn = db()
    audit(conn, auth.actor(), "LOGIN", "session", 0, {"email": email})
    conn.commit()
    return jsonify({"user": auth.current_user()}), 200


@app.post("/api/auth/logout")
def api_logout():
    if auth.current_user():
        conn = db()
        audit(conn, auth.actor(), "LOGOUT", "session", 0, None)
        conn.commit()
    auth.logout_user()
    return jsonify({"ok": True}), 200


@app.get("/api/auth/me")
def api_me():
    u = auth.current_user()
    if not u:
        return jsonify({"error": "auth_required"}), 401
    return jsonify({"user": u}), 200


@app.get("/api/health")
def health():
    """App health — never depends on the AI service (safe for Vercel)."""
    from ai import config as ai_config
    ok, broken = verify_chain(db())
    return jsonify({
        "status": "ok",
        "audit_chain_intact": ok,
        "first_broken_row": broken,
        "ai_enabled": ai_config.AI_ENABLED,
    })


# --- FR-2 : Quick registration ---------------------------------------
@app.post("/api/quick-reg")
@auth.requires("register")
def quick_reg():
    """
    Treat-first registration. Art. 21 + Parmanand Katara (SC 1989).

    ZERO mandatory fields. An empty POST body is valid and MUST succeed —
    that is not a bug to be hardened away, it is the requirement. The
    unconscious RTA victim with no attender gets a temp ID and a triage
    slot, and the paperwork catches up later or never.
    """
    body = request.get_json(silent=True) or {}
    conn = db()
    ts = now()
    year = datetime.now(timezone.utc).year

    is_unknown = not body.get("name")

    temp_id = None
    if is_unknown or not body.get("uhid"):
        n = conn.execute(
            "SELECT COUNT(*) c FROM patient WHERE temp_id LIKE ?", (f"TMP-{year}-%",)
        ).fetchone()["c"]
        temp_id = f"TMP-{year}-{n + 1:04d}"

    cur = conn.execute(
        """INSERT INTO patient
           (uhid, temp_id, name, age_years, sex, phone, is_unknown, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (body.get("uhid"), temp_id, body.get("name"), body.get("age_years"),
         body.get("sex"), body.get("phone"), 1 if is_unknown else 0, ts),
    )
    patient_id = cur.lastrowid

    cur = conn.execute(
        """INSERT INTO ed_encounter
           (patient_id, arrival_ts, arrival_mode, brought_by, cashless_scheme, status)
           VALUES (?,?,?,?,?, 'ARRIVED')""",
        (patient_id, ts, body.get("arrival_mode"), body.get("brought_by"),
         body.get("cashless_scheme") or None),
    )
    encounter_id = cur.lastrowid

    audit(conn, auth.actor(), "QUICK_REG", "ed_encounter",
          encounter_id, {"is_unknown": is_unknown, "temp_id": temp_id})
    conn.commit()

    return jsonify({
        "patient_id": patient_id,
        "encounter_id": encounter_id,
        "temp_id": temp_id,
        "is_unknown": is_unknown,
    }), 201


# --- FR-1 : Triage ----------------------------------------------------
@app.post("/api/triage/suggest")
@auth.login_required
def triage_suggest():
    """Dry-run the rules engine. Suggests; never writes; never decides."""
    body = request.get_json(silent=True) or {}
    return jsonify(triage_rules.evaluate(
        vitals=body.get("vitals", {}),
        red_flags=body.get("red_flags", []),
    ))


@app.post("/api/triage")
@auth.requires("triage")
def triage_commit():
    """
    Commit a triage. The nurse's final_level is authoritative.

    If they depart from the suggestion, the reason is mandatory — enforced
    in the schema (triage_event CHECK), not merely in the UI. A validation
    rule that lives only in JavaScript is a validation rule that a curl
    command deletes.
    """
    body = request.get_json(silent=True) or {}
    encounter_id = body["encounter_id"]
    vitals = body.get("vitals", {})
    red_flags = body.get("red_flags", [])
    triaged_by = auth.actor()   # session-derived; body cannot override

    result = triage_rules.evaluate(vitals=vitals, red_flags=red_flags)
    suggested = result["suggested_level"]
    final = body.get("final_level", suggested)
    reason = body.get("override_reason")

    if final != suggested and (not reason or len(reason.strip()) < 10):
        return jsonify({
            "error": "override_reason_required",
            "detail": ("Departing from the suggested level requires a recorded "
                       "reason of at least 10 characters. PRD-05 §11: overrides "
                       "are reported to the medical director monthly."),
            "suggested_level": suggested,
        }), 422

    conn = db()
    cur = conn.execute(
        """INSERT INTO triage_event
           (encounter_id, triaged_ts, chief_complaint, hr, rr, sbp, dbp,
            spo2, temp_c, gcs, red_flags_json, suggested_level, final_level,
            override_reason, triaged_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (encounter_id, now(), body.get("chief_complaint", ""),
         vitals.get("hr"), vitals.get("rr"), vitals.get("sbp"), vitals.get("dbp"),
         vitals.get("spo2"), vitals.get("temp_c"), vitals.get("gcs"),
         json.dumps(red_flags), suggested, final, reason, triaged_by),
    )
    triage_id = cur.lastrowid
    conn.execute(
        "UPDATE ed_encounter SET status='TRIAGED' WHERE id=? AND status='ARRIVED'",
        (encounter_id,),
    )

    if final != suggested:
        audit(conn, triaged_by, "TRIAGE_OVERRIDE", "triage_event", triage_id,
              {"suggested": suggested, "final": final, "reason": reason,
               "direction": "DOWNGRADED" if final > suggested else "UPGRADED"})
    else:
        audit(conn, triaged_by, "TRIAGE", "triage_event", triage_id,
              {"level": final})
    conn.commit()

    return jsonify({
        "triage_id": triage_id,
        "suggested_level": suggested,
        "final_level": final,
        "overridden": final != suggested,
        "reasons": result["reasons"],
    }), 201


# --- FR-4 : MLC -------------------------------------------------------
@app.post("/api/mlc")
@auth.requires("mlc")
def open_mlc():
    """Open an MLC. Allocates a gapless statutory serial."""
    body = request.get_json(silent=True) or {}
    encounter_id = body["encounter_id"]
    mlc_type = body["mlc_type"]
    opened_by = auth.actor()    # session-derived; body cannot override
    year = datetime.now(timezone.utc).year

    conn = db()
    serial, seq = next_mlc_serial(conn, year)

    # POCSO §19-21: non-reporting is itself an offence. The flag is set at
    # open time and cannot be cleared through this API — there is no
    # endpoint to unset it, by design.
    pocso = 1 if mlc_type == "SEXUAL_OFFENCE_POCSO" else 0

    cur = conn.execute(
        """INSERT INTO mlc_case
           (encounter_id, mlc_serial, mlc_year, mlc_seq, mlc_type,
            pocso_flag, opened_ts, opened_by)
           VALUES (?,?,?,?,?,?,?,?)""",
        (encounter_id, serial, year, seq, mlc_type, pocso, now(), opened_by),
    )
    mlc_id = cur.lastrowid
    conn.execute("UPDATE ed_encounter SET is_mlc=1 WHERE id=?", (encounter_id,))

    audit(conn, opened_by, "MLC_OPEN", "mlc_case", mlc_id,
          {"serial": serial, "type": mlc_type, "pocso": bool(pocso)})
    conn.commit()

    return jsonify({
        "mlc_id": mlc_id,
        "mlc_serial": serial,
        "pocso_flag": bool(pocso),
        "statutory_basis": "BNSS 2023 §194-196",
        "warning": ("POCSO §19-21: reporting to SJPU/police is mandatory and "
                    "non-reporting is punishable.") if pocso else None,
    }), 201


@app.post("/api/mlc/<int:mlc_id>/intimation")
@auth.requires("intimation")
def log_intimation(mlc_id):
    """
    Record the police intimation. This IS the statutory evidence.

    PRD-05 §13, absent a state e-portal: "statutory duty met manually,
    evidenced digitally." The constable's name and badge are mandatory
    because "we informed the police" is not a defence — "we informed
    Constable Ramesh, badge 4471, by phone at 03:14" is.
    """
    body = request.get_json(silent=True) or {}
    conn = db()
    cur = conn.execute(
        """INSERT INTO police_intimation
           (mlc_case_id, intimated_ts, police_station, constable_name,
            constable_badge, mode, ack_ref, logged_by)
           VALUES (?,?,?,?,?,?,?,?)""",
        (mlc_id, body.get("intimated_ts", now()), body["police_station"],
         body["constable_name"], body["constable_badge"], body["mode"],
         body.get("ack_ref"), auth.actor()),
    )
    intimation_id = cur.lastrowid
    audit(conn, auth.actor(), "INTIMATION_LOG",
          "police_intimation", intimation_id,
          {"mlc_case_id": mlc_id, "mode": body["mode"]})
    conn.commit()
    return jsonify({"intimation_id": intimation_id}), 201


# --- FR-8 : Dispositions ---------------------------------------------
@app.post("/api/disposition")
@auth.requires("dispose")
def disposition():
    """
    Close the encounter.

    US-6 / the compliance showpiece: if this encounter is an MLC and no
    police intimation has been logged, we WARN — hard, with the statute
    cited — and require a recorded justification to proceed.

    We warn rather than block. Blocking a disposition would mean the
    software holds a patient in the ED to protect its own compliance
    record, which inverts the entire point: Art. 21 says care is never
    delayed by police formalities. So the patient always leaves. The
    silence just goes on the record with a name attached to it.
    """
    body = request.get_json(silent=True) or {}
    encounter_id = body["encounter_id"]
    dtype = body["type"]
    decided_by = auth.actor()   # session-derived; body cannot override

    conn = db()
    enc = conn.execute(
        "SELECT * FROM ed_encounter WHERE id=?", (encounter_id,)
    ).fetchone()
    if enc is None:
        return jsonify({"error": "encounter_not_found"}), 404

    intimation_pending = False
    if enc["is_mlc"]:
        n = conn.execute(
            """SELECT COUNT(*) c FROM police_intimation pi
               JOIN mlc_case m ON m.id = pi.mlc_case_id
               WHERE m.encounter_id = ?""",
            (encounter_id,),
        ).fetchone()["c"]
        intimation_pending = (n == 0)

    ack = 1 if body.get("mlc_warning_ack") else 0
    ack_reason = body.get("mlc_warning_reason")

    if intimation_pending and not (ack and ack_reason and len(ack_reason.strip()) >= 10):
        return jsonify({
            "error": "mlc_intimation_pending",
            "statutory_basis": "BNSS 2023 §194-196",
            "detail": ("This is an MLC encounter with no police intimation "
                       "logged. Log the intimation, or acknowledge and record "
                       "a justification (min. 10 chars) to proceed."),
            "blocking": False,
        }), 409

    conn.execute(
        """INSERT INTO disposition
           (encounter_id, type, decided_ts, decided_by, ward_requested,
            referral_facility, referral_reason, discharge_instr,
            lama_counselled_by, lama_risks_explained, lama_witness,
            death_ts, cause_of_death_icd10, mccd_form4_ref,
            mlc_warning_ack, mlc_warning_reason)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (encounter_id, dtype, now(), decided_by, body.get("ward_requested"),
         body.get("referral_facility"), body.get("referral_reason"),
         body.get("discharge_instr"), body.get("lama_counselled_by"),
         body.get("lama_risks_explained"), body.get("lama_witness"),
         body.get("death_ts"), body.get("cause_of_death_icd10"),
         body.get("mccd_form4_ref"), ack, ack_reason),
    )
    conn.execute(
        "UPDATE ed_encounter SET status='CLOSED', closed_ts=? WHERE id=?",
        (now(), encounter_id),
    )
    audit(conn, decided_by, "DISPOSITION", "ed_encounter", encounter_id,
          {"type": dtype, "mlc_warning_ack": bool(ack)})
    conn.commit()

    stub = None
    if dtype == "ADMIT":
        # PRD-02 is a 🟡 dependency. Fallback per PRD-05 §13:
        # "phone-based admission continues".
        stub = {"bed_request": "STUBBED -> PRD-02",
                "ward": body.get("ward_requested")}

    return jsonify({"encounter_id": encounter_id, "type": dtype,
                    "stub": stub}), 201


# --- Read models ------------------------------------------------------
@app.get("/api/board")
@auth.login_required
def board():
    rows = db().execute(
        "SELECT * FROM v_tracking_board WHERE status <> 'CLOSED' "
        "ORDER BY level, arrival_ts"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/reports/overrides")
@auth.login_required
def overrides():
    """PRD-05 §11: overrides reported to the medical director monthly."""
    rows = db().execute("SELECT * FROM v_override_report").fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/audit/verify")
@auth.login_required
def audit_verify():
    ok, broken = verify_chain(db())
    return jsonify({"chain_intact": ok, "first_broken_row": broken})


# --- FR-3 : Physician attends (door-to-doctor) -----------------------
@app.post("/api/encounters/<int:encounter_id>/attend")
@auth.requires("attend")
def attend(encounter_id):
    """
    A physician picks up the patient. Stamps door-to-doctor server-side and
    moves the encounter to IN_TREATMENT. The stamp is only set once — the
    NABH time-norm is *first* physician contact, so a second attend never
    overwrites it.
    """
    body = request.get_json(silent=True) or {}
    who = auth.actor()          # session-derived; body cannot override
    conn = db()
    enc = conn.execute(
        "SELECT * FROM ed_encounter WHERE id=?", (encounter_id,)
    ).fetchone()
    if enc is None:
        return jsonify({"error": "encounter_not_found"}), 404
    if enc["status"] == "CLOSED":
        return jsonify({"error": "encounter_closed"}), 409

    ts = now()
    conn.execute(
        """UPDATE ed_encounter
           SET status='IN_TREATMENT',
               first_physician_at = COALESCE(first_physician_at, ?),
               attended_by        = COALESCE(attended_by, ?)
           WHERE id=?""",
        (ts, who, encounter_id),
    )
    audit(conn, who, "PHYSICIAN_ATTEND", "ed_encounter", encounter_id,
          {"door_to_doctor_at": ts})
    conn.commit()
    return jsonify({"encounter_id": encounter_id, "first_physician_at": ts,
                    "status": "IN_TREATMENT"}), 200


# --- FR-3 : bay / location allocation --------------------------------
@app.post("/api/encounters/<int:encounter_id>/bay")
@auth.requires("triage")   # triage nurse / charge nurse allocates bays
def set_bay(encounter_id):
    """Assign (or clear) the physical bay/location for flow management."""
    body = request.get_json(silent=True) or {}
    bay = (body.get("bay") or "").strip()[:24] or None
    conn = db()
    enc = conn.execute("SELECT id FROM ed_encounter WHERE id=?", (encounter_id,)).fetchone()
    if enc is None:
        return jsonify({"error": "encounter_not_found"}), 404
    conn.execute("UPDATE ed_encounter SET bay=? WHERE id=?", (bay, encounter_id))
    audit(conn, auth.actor(), "BAY_ASSIGNED", "ed_encounter", encounter_id, {"bay": bay})
    conn.commit()
    return jsonify({"encounter_id": encounter_id, "bay": bay}), 200


# --- Read models the console renders ---------------------------------
def _patient_dict(conn, patient_id):
    p = conn.execute("SELECT * FROM patient WHERE id=?", (patient_id,)).fetchone()
    return dict(p) if p else None


@app.get("/api/encounters")
@auth.login_required
def list_encounters():
    """ED register — filtered encounter list (newest first, capped)."""
    conn = db()
    q = (request.args.get("q") or "").strip().lower()
    level = request.args.get("level")
    mlc = request.args.get("mlc")
    status = request.args.get("status")
    rows = conn.execute("SELECT * FROM v_tracking_board ORDER BY arrival_ts DESC").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if q and q not in (str(d.get("display_name") or "").lower()
                           + " " + str(d.get("identifier") or "").lower()
                           + " " + str(d.get("chief_complaint") or "").lower()):
            continue
        if level and str(d.get("level")) != str(level):
            continue
        if mlc == "1" and not d.get("is_mlc"):
            continue
        if status and d.get("status") != status:
            continue
        out.append(d)
    return jsonify(out[:200])


@app.get("/api/encounters/<int:encounter_id>")
@auth.login_required
def encounter_detail(encounter_id):
    """The encounter hub: patient, triage history, MLC + intimations, disposition."""
    conn = db()
    enc = conn.execute(
        "SELECT * FROM ed_encounter WHERE id=?", (encounter_id,)
    ).fetchone()
    if enc is None:
        return jsonify({"error": "encounter_not_found"}), 404
    enc = dict(enc)
    patient = _patient_dict(conn, enc["patient_id"])
    triages = [dict(r) for r in conn.execute(
        "SELECT * FROM triage_event WHERE encounter_id=? ORDER BY triaged_ts DESC",
        (encounter_id,))]
    for t in triages:
        try:
            t["red_flags"] = json.loads(t.get("red_flags_json") or "[]")
        except (ValueError, TypeError):
            t["red_flags"] = []

    mlc = conn.execute(
        "SELECT * FROM mlc_case WHERE encounter_id=?", (encounter_id,)
    ).fetchone()
    mlc = dict(mlc) if mlc else None
    intimations = []
    if mlc:
        intimations = [dict(r) for r in conn.execute(
            "SELECT * FROM police_intimation WHERE mlc_case_id=? ORDER BY intimated_ts",
            (mlc["id"],))]

    disp = conn.execute(
        "SELECT * FROM disposition WHERE encounter_id=?", (encounter_id,)
    ).fetchone()

    intimation_pending = bool(enc["is_mlc"]) and len(intimations) == 0

    # FR-5 injuries, FR-11 pathway timers, FR-7 reporting duties (read-model extension)
    injuries = [dict(r) for r in conn.execute(
        "SELECT * FROM injury_note WHERE encounter_id=? ORDER BY id", (encounter_id,))]
    timers = [dict(r) for r in conn.execute(
        "SELECT * FROM pathway_timer WHERE encounter_id=? ORDER BY id", (encounter_id,))]
    latest = triages[0] if triages else None
    duties = reporting.duties_for(
        mlc["mlc_type"] if mlc else None,
        latest["red_flags"] if latest else [],
        latest["chief_complaint"] if latest else None,
        enc["arrival_mode"])
    acks = [dict(r) for r in conn.execute(
        "SELECT * FROM reporting_ack WHERE encounter_id=? ORDER BY id", (encounter_id,))]
    acked = {a["duty"] for a in acks}
    reporting_pending = [d for d in duties if d["code"] not in acked]

    return jsonify({
        "encounter": enc,
        "patient": patient,
        "triages": triages,
        "mlc": mlc,
        "intimations": intimations,
        "disposition": dict(disp) if disp else None,
        "intimation_pending": intimation_pending,
        "injuries": injuries,
        "timers": timers,
        "cashless_scheme": enc.get("cashless_scheme"),
        "reporting": {"duties": duties, "acks": acks, "pending": reporting_pending},
    })


@app.get("/api/mlc")
@auth.login_required
def list_mlc():
    """MLC register — all cases, newest first, with intimation counts."""
    conn = db()
    rows = conn.execute(
        """SELECT m.*, e.status AS enc_status,
                  COALESCE(p.name, '[UNKNOWN] ' || p.temp_id) AS display_name,
                  COALESCE(p.uhid, p.temp_id) AS identifier,
                  (SELECT COUNT(*) FROM police_intimation pi
                     WHERE pi.mlc_case_id = m.id) AS intimation_count
           FROM mlc_case m
           JOIN ed_encounter e ON e.id = m.encounter_id
           JOIN patient p      ON p.id = e.patient_id
           ORDER BY m.opened_ts DESC"""
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.get("/api/mlc/<int:mlc_id>")
@auth.login_required
def mlc_detail(mlc_id):
    conn = db()
    m = conn.execute("SELECT * FROM mlc_case WHERE id=?", (mlc_id,)).fetchone()
    if m is None:
        return jsonify({"error": "mlc_not_found"}), 404
    m = dict(m)
    enc = conn.execute(
        "SELECT * FROM ed_encounter WHERE id=?", (m["encounter_id"],)
    ).fetchone()
    patient = _patient_dict(conn, enc["patient_id"]) if enc else None
    intimations = [dict(r) for r in conn.execute(
        "SELECT * FROM police_intimation WHERE mlc_case_id=? ORDER BY intimated_ts",
        (mlc_id,))]
    # FR-6 chain-of-custody evidence log
    evidence = [dict(r) for r in conn.execute(
        "SELECT * FROM evidence_item WHERE mlc_case_id=? ORDER BY id", (mlc_id,))]
    injuries = [dict(r) for r in conn.execute(
        "SELECT * FROM injury_note WHERE encounter_id=? ORDER BY id", (m["encounter_id"],))]
    return jsonify({
        "mlc": m,
        "encounter": dict(enc) if enc else None,
        "patient": patient,
        "intimations": intimations,
        "evidence": evidence,
        "injuries": injuries,
    })


@app.get("/api/audit")
@auth.login_required
def list_audit():
    """Audit trail (≤300 newest) plus a live hash-chain verdict."""
    conn = db()
    action = request.args.get("action")
    q = (request.args.get("q") or "").strip().lower()
    rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 300").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if action and d["action"] != action:
            continue
        if q and q not in json.dumps(d).lower():
            continue
        out.append(d)
    ok, broken = verify_chain(conn)
    actions = [r["action"] for r in conn.execute(
        "SELECT DISTINCT action FROM audit_log ORDER BY action")]
    return jsonify({"entries": out, "chain_intact": ok,
                    "first_broken_row": broken, "actions": actions})


@app.get("/api/scale")
@auth.login_required
def scale():
    """The active triage scale — level labels, colours, targets, red flags."""
    conn = db()
    rows = conn.execute(
        "SELECT * FROM triage_scale_config WHERE active=1 ORDER BY level"
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["criteria"] = json.loads(d.pop("criteria_json"))
        except (ValueError, TypeError):
            d["criteria"] = {}
        out.append(d)
    return jsonify(out)


@app.get("/api/dashboard")
@auth.login_required
def dashboard():
    """Operational KPIs, computed from data — no hardcoded numbers."""
    conn = db()

    def scalar(sql, args=()):
        return conn.execute(sql, args).fetchone()[0]

    board = [dict(r) for r in conn.execute(
        "SELECT * FROM v_tracking_board WHERE status <> 'CLOSED'")]
    active = len(board)
    awaiting_triage = sum(1 for b in board if b["status"] == "ARRIVED")
    awaiting_phys = sum(1 for b in board if b["status"] == "TRIAGED")
    in_treatment = sum(1 for b in board if b["status"] == "IN_TREATMENT")
    breaches = sum(1 for b in board if b["is_breached"])
    mlc_active = sum(1 for b in board if b["is_mlc"])

    level_mix = {str(i): 0 for i in range(1, 6)}
    for b in board:
        if b["level"]:
            level_mix[str(b["level"])] += 1

    disp_rows = conn.execute(
        "SELECT type, COUNT(*) c FROM disposition GROUP BY type").fetchall()
    disp_mix = {r["type"]: r["c"] for r in disp_rows}

    # Door-to-doctor: median minutes over encounters that have been attended.
    d2d = [r["m"] for r in conn.execute(
        """SELECT CAST((julianday(first_physician_at) - julianday(arrival_ts))
                       * 1440 AS INTEGER) m
           FROM ed_encounter
           WHERE first_physician_at IS NOT NULL""")]
    def _median(vals):
        if not vals:
            return None
        vals.sort(); m = len(vals) // 2
        return vals[m] if len(vals) % 2 else (vals[m - 1] + vals[m]) / 2

    d2d_median = _median(d2d)

    # FR-13: ED length-of-stay (median, minutes) over closed encounters.
    los = [r["m"] for r in conn.execute(
        """SELECT CAST((julianday(closed_ts) - julianday(arrival_ts)) * 1440 AS INTEGER) m
           FROM ed_encounter WHERE status='CLOSED' AND closed_ts IS NOT NULL""")]
    los_median = _median(los)
    # FR-13: LWBS — left without being seen (a disposition of type LWBS).
    lwbs = scalar("SELECT COUNT(*) FROM disposition WHERE type='LWBS'")
    closed_total = scalar("SELECT COUNT(*) FROM ed_encounter WHERE status='CLOSED'")
    lwbs_rate = round(lwbs / closed_total * 100, 1) if closed_total else 0.0

    total_patients = scalar("SELECT COUNT(*) FROM patient")
    total_encounters = scalar("SELECT COUNT(*) FROM ed_encounter")
    unknown_active = sum(1 for b in board if b["is_unknown"])
    overrides = scalar("SELECT COUNT(*) FROM triage_event WHERE override_reason IS NOT NULL")
    intimation_pending = scalar(
        """SELECT COUNT(*) FROM mlc_case m
           JOIN ed_encounter e ON e.id = m.encounter_id
           WHERE e.status <> 'CLOSED'
             AND NOT EXISTS (SELECT 1 FROM police_intimation pi
                             WHERE pi.mlc_case_id = m.id)""")
    inbound = scalar("SELECT COUNT(*) FROM prearrival WHERE status='INBOUND'")
    mci_active = scalar("SELECT COUNT(*) FROM ed_encounter WHERE mci_tag IS NOT NULL")
    ok, broken = verify_chain(conn)

    return jsonify({
        "active_encounters": active,
        "awaiting_triage": awaiting_triage,
        "awaiting_physician": awaiting_phys,
        "in_treatment": in_treatment,
        "breaches": breaches,
        "mlc_active": mlc_active,
        "unknown_active": unknown_active,
        "level_mix": level_mix,
        "disposition_mix": disp_mix,
        "door_to_doctor_median_min": d2d_median,
        "los_median_min": los_median,
        "lwbs_count": lwbs,
        "lwbs_rate": lwbs_rate,
        "total_patients": total_patients,
        "total_encounters": total_encounters,
        "overrides": overrides,
        "intimation_pending": intimation_pending,
        "inbound": inbound,
        "mci_count": mci_active,
        "audit_chain_intact": ok,
        "audit_first_broken_row": broken,
        "generated_at": now(),
    })


# --- Demo controls (dev/demo only) -----------------------------------
@app.post("/api/demo/reset")
@auth.requires("reset_demo")
def demo_reset():
    """
    Rebuild the deterministic demo database. Guarded: only runs when the app
    is in debug mode, so it can never wipe a production database by accident.
    """
    if not app.debug:
        return jsonify({"error": "demo_reset_disabled",
                        "detail": "Demo reset only runs in debug/demo mode."}), 403
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()
    subprocess.run([sys.executable, str(HERE / "seed.py")], check=True, cwd=HERE)
    return jsonify({"status": "reseeded"}), 200


# --- Advisory AI: local Ollama-backed Advanced RAG ------------------
# Advisory only. Behind the AI_ENABLED boundary: when disabled (e.g. on
# Vercel) these endpoints return a clean "disabled" state and the app makes
# zero calls to Ollama. When enabled, /ask runs the Advanced RAG pipeline.
@app.get("/api/ai/health")
@auth.login_required
def ai_health():
    from ai import config as _cfg
    if not _cfg.AI_ENABLED:
        return jsonify({"available": False, "ai_enabled": False, "disabled": True,
                        "reason": "AI is disabled in this deployment (AI_ENABLED=false)."})
    from ai import ollama_client as _oc, rag as _rag
    h = _oc.health()
    h["ai_enabled"] = True
    h["index_ready"] = _rag._INDEX is not None
    return jsonify(h)


@app.post("/api/ai/ask")
@auth.login_required
def ai_ask():
    from ai import config as _cfg
    body = request.get_json(silent=True) or {}
    if not _cfg.AI_ENABLED:
        return jsonify({"ok": False, "disabled": True, "degraded": True, "confidence": "Low",
                        "answer": "The AI copilot is disabled in this deployment. "
                                  "Run the full local stack (Ollama) to enable it."})
    from ai import advanced as _adv
    result = _adv.pipeline((body.get("query") or "").strip(), screen_context=body.get("context"))
    # Auditing AI use is a first-class requirement: who asked what, how grounded.
    conn = db()
    audit(conn, auth.actor(), "AI_QUERY", "ai", 0,
          {"q": (body.get("query") or "")[:200],
           "classification": (result.get("query_processing") or {}).get("classification"),
           "confidence": result.get("confidence"),
           "degraded": bool(result.get("degraded")),
           "citations": [c.get("chunk_id") for c in result.get("citations", [])]})
    conn.commit()
    return jsonify(result)


# --- FR-5 : Injury documentation (body-map) --------------------------
@app.post("/api/encounters/<int:encounter_id>/injury")
@auth.requires("triage")
def add_injury(encounter_id):
    b = request.get_json(silent=True) or {}
    if not b.get("region") or not b.get("wound_type"):
        return jsonify({"error": "region_and_type_required"}), 422
    conn = db()
    cur = conn.execute(
        """INSERT INTO injury_note(encounter_id,region,wound_type,description,
               photo_consent,photo_ref,recorded_by,recorded_at) VALUES (?,?,?,?,?,?,?,?)""",
        (encounter_id, b["region"], b["wound_type"], b.get("description"),
         b.get("photo_consent"), b.get("photo_ref"), auth.actor(), now()))
    audit(conn, auth.actor(), "INJURY_NOTE", "injury_note", cur.lastrowid,
          {"encounter": encounter_id, "region": b["region"], "type": b["wound_type"]})
    conn.commit()
    return jsonify({"id": cur.lastrowid}), 201


# --- FR-6 : Evidence / chain-of-custody ------------------------------
@app.post("/api/mlc/<int:mlc_id>/evidence")
@auth.requires("mlc")
def add_evidence(mlc_id):
    b = request.get_json(silent=True) or {}
    if not b.get("item"):
        return jsonify({"error": "item_required"}), 422
    conn = db()
    cur = conn.execute(
        """INSERT INTO evidence_item(mlc_case_id,item,description,collected_by,
               handed_to,handed_badge,signature_ref,recorded_at) VALUES (?,?,?,?,?,?,?,?)""",
        (mlc_id, b["item"], b.get("description"), auth.actor(), b.get("handed_to"),
         b.get("handed_badge"), b.get("signature_ref"), now()))
    audit(conn, auth.actor(), "EVIDENCE_LOGGED", "evidence_item", cur.lastrowid,
          {"mlc": mlc_id, "item": b["item"]})
    conn.commit()
    return jsonify({"id": cur.lastrowid}), 201


# --- FR-7 : Mandatory-reporting engine -------------------------------
@app.get("/api/encounters/<int:encounter_id>/reporting")
@auth.login_required
def get_reporting(encounter_id):
    conn = db()
    enc = conn.execute("SELECT * FROM ed_encounter WHERE id=?", (encounter_id,)).fetchone()
    if enc is None:
        return jsonify({"error": "not_found"}), 404
    mlc = conn.execute("SELECT mlc_type FROM mlc_case WHERE encounter_id=?", (encounter_id,)).fetchone()
    tri = conn.execute("SELECT chief_complaint, red_flags_json FROM triage_event "
                       "WHERE encounter_id=? ORDER BY id DESC LIMIT 1", (encounter_id,)).fetchone()
    red, complaint = [], None
    if tri:
        complaint = tri["chief_complaint"]
        try:
            red = json.loads(tri["red_flags_json"] or "[]")
        except (ValueError, TypeError):
            red = []
    duties = reporting.duties_for(mlc["mlc_type"] if mlc else None, red, complaint, enc["arrival_mode"])
    acks = [dict(r) for r in conn.execute(
        "SELECT * FROM reporting_ack WHERE encounter_id=? ORDER BY id", (encounter_id,))]
    return jsonify({"duties": duties, "acks": acks})


@app.post("/api/encounters/<int:encounter_id>/reporting/ack")
@auth.login_required
def ack_reporting(encounter_id):
    b = request.get_json(silent=True) or {}
    action = b.get("action")   # REPORTED | DISMISSED
    just = (b.get("justification") or "").strip()
    if action == "DISMISSED" and len(just) < 10:
        return jsonify({"error": "justification_required",
                        "detail": "Dismissing a mandatory-reporting duty requires a recorded "
                                  "reason (min 10 chars)."}), 422
    conn = db()
    cur = conn.execute("""INSERT INTO reporting_ack(encounter_id,duty,action,justification,acted_by,acted_at)
                          VALUES (?,?,?,?,?,?)""",
                       (encounter_id, b.get("duty"), action, just or None, auth.actor(), now()))
    audit(conn, auth.actor(), "REPORTING_" + str(action), "reporting_ack", cur.lastrowid,
          {"encounter": encounter_id, "duty": b.get("duty")})
    conn.commit()
    return jsonify({"id": cur.lastrowid}), 201


# --- FR-9 : Pre-arrival / ambulance intake ---------------------------
@app.get("/api/prearrival")
@auth.login_required
def list_prearrival():
    return jsonify([dict(r) for r in db().execute(
        "SELECT * FROM prearrival ORDER BY (status='INBOUND') DESC, id DESC LIMIT 100")])


@app.post("/api/prearrival")
@auth.requires("register")
def add_prearrival():
    b = request.get_json(silent=True) or {}
    conn = db()
    cur = conn.execute(
        """INSERT INTO prearrival(source,eta_minutes,age_years,sex,complaint,vitals_json,code,logged_by,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (b.get("source", "108"), b.get("eta_minutes"), b.get("age_years"), b.get("sex"),
         b.get("complaint"), json.dumps(b.get("vitals") or {}), b.get("code") or "NONE",
         auth.actor(), now()))
    audit(conn, auth.actor(), "PREARRIVAL", "prearrival", cur.lastrowid,
          {"code": b.get("code"), "eta": b.get("eta_minutes")})
    conn.commit()
    return jsonify({"id": cur.lastrowid}), 201


@app.post("/api/prearrival/<int:pid>/close")
@auth.requires("register")
def close_prearrival(pid):
    b = request.get_json(silent=True) or {}
    st = "ARRIVED" if b.get("arrived") else "CANCELLED"
    conn = db()
    conn.execute("UPDATE prearrival SET status=? WHERE id=?", (st, pid))
    audit(conn, auth.actor(), "PREARRIVAL_" + st, "prearrival", pid, {})
    conn.commit()
    return jsonify({"status": st})


# --- FR-11 : Time-critical pathway timers ----------------------------
@app.post("/api/encounters/<int:encounter_id>/timer")
@auth.requires("triage")
def stamp_timer(encounter_id):
    b = request.get_json(silent=True) or {}
    if b.get("kind") not in ("ECG", "CT", "NEEDLE", "BALLOON"):
        return jsonify({"error": "bad_kind"}), 422
    conn = db()
    ts = now()
    conn.execute("""INSERT INTO pathway_timer(encounter_id,kind,stamped_at,stamped_by)
                    VALUES (?,?,?,?) ON CONFLICT(encounter_id,kind) DO NOTHING""",
                 (encounter_id, b["kind"], ts, auth.actor()))
    audit(conn, auth.actor(), "PATHWAY_TIMER", "pathway_timer", encounter_id,
          {"kind": b["kind"], "at": ts})
    conn.commit()
    return jsonify({"kind": b["kind"], "stamped_at": ts})


# --- FR-14 : Cashless / free-treatment entitlement -------------------
@app.post("/api/encounters/<int:encounter_id>/cashless")
@auth.requires("register")
def set_cashless(encounter_id):
    b = request.get_json(silent=True) or {}
    conn = db()
    conn.execute("UPDATE ed_encounter SET cashless_scheme=? WHERE id=?",
                 (b.get("scheme") or None, encounter_id))
    audit(conn, auth.actor(), "CASHLESS_SET", "ed_encounter", encounter_id,
          {"scheme": b.get("scheme")})
    conn.commit()
    return jsonify({"scheme": b.get("scheme")})


# --- FR-10 : MCI / mass-casualty mode --------------------------------
_MCI_LEVEL = {"RED": 1, "YELLOW": 3, "GREEN": 4, "BLACK": None}


@app.post("/api/mci/register")
@auth.requires("register")
def mci_register():
    b = request.get_json(silent=True) or {}
    tag = b.get("tag")
    if tag not in _MCI_LEVEL:
        return jsonify({"error": "bad_tag"}), 422
    conn = db()
    ts = now()
    year = datetime.now(timezone.utc).year
    n = conn.execute("SELECT COUNT(*) c FROM patient WHERE temp_id LIKE ?",
                     (f"MCI-{year}-%",)).fetchone()["c"]
    temp = f"MCI-{year}-{n + 1:04d}"
    pid = conn.execute("INSERT INTO patient(uhid,temp_id,name,is_unknown,created_at) "
                       "VALUES (NULL,?,NULL,1,?)", (temp, ts)).lastrowid
    closed = tag == "BLACK"
    eid = conn.execute(
        """INSERT INTO ed_encounter(patient_id,arrival_ts,arrival_mode,is_mlc,status,mci_tag,closed_ts)
           VALUES (?,?,?,?,?,?,?)""",
        (pid, ts, "AMBULANCE_108", 1 if closed else 0,
         "CLOSED" if closed else "TRIAGED", tag, ts if closed else None)).lastrowid
    lvl = _MCI_LEVEL[tag]
    if lvl:
        conn.execute(
            """INSERT INTO triage_event(encounter_id,triaged_ts,chief_complaint,red_flags_json,
                   suggested_level,final_level,triaged_by) VALUES (?,?,?,?,?,?,?)""",
            (eid, ts, f"MCI casualty ({tag})", "[]", lvl, lvl, auth.actor()))
    audit(conn, auth.actor(), "MCI_REGISTER", "ed_encounter", eid, {"tag": tag, "temp_id": temp})
    conn.commit()
    return jsonify({"encounter_id": eid, "temp_id": temp, "tag": tag}), 201


@app.get("/api/mci")
@auth.login_required
def mci_tally():
    conn = db()
    tally = {r["tag"]: r["c"] for r in conn.execute(
        "SELECT mci_tag tag, COUNT(*) c FROM ed_encounter WHERE mci_tag IS NOT NULL GROUP BY mci_tag")}
    cas = [dict(r) for r in conn.execute(
        """SELECT e.id encounter_id, e.mci_tag tag, e.status,
                  COALESCE(p.name, p.temp_id) label, e.arrival_ts
           FROM ed_encounter e JOIN patient p ON p.id=e.patient_id
           WHERE e.mci_tag IS NOT NULL ORDER BY e.id DESC""")]
    return jsonify({"tally": tally, "casualties": cas, "total": sum(tally.values())})


# --- AI-3 : Deterioration watch (rule-based; works even AI-off) ------
@app.get("/api/ai/deterioration")
@auth.login_required
def ai_deterioration():
    conn = db()
    flagged = []
    for r in conn.execute("""SELECT e.id, COALESCE(p.name,p.temp_id) label FROM ed_encounter e
                             JOIN patient p ON p.id=e.patient_id
                             WHERE e.status IN ('ARRIVED','TRIAGED')"""):
        tri = conn.execute("SELECT hr,rr,sbp,spo2,gcs FROM triage_event WHERE encounter_id=? "
                           "ORDER BY id DESC LIMIT 2", (r["id"],)).fetchall()
        if len(tri) < 2:
            continue
        c, p = tri[0], tri[1]
        reasons = []
        if c["spo2"] and p["spo2"] and c["spo2"] < p["spo2"] - 2:
            reasons.append(f"SpO2 {p['spo2']}->{c['spo2']}")
        if c["sbp"] and p["sbp"] and c["sbp"] < p["sbp"] - 10:
            reasons.append(f"SBP {p['sbp']}->{c['sbp']}")
        if c["hr"] and p["hr"] and c["hr"] > p["hr"] + 15:
            reasons.append(f"HR {p['hr']}->{c['hr']}")
        if c["gcs"] and p["gcs"] and c["gcs"] < p["gcs"]:
            reasons.append(f"GCS {p['gcs']}->{c['gcs']}")
        if reasons:
            flagged.append({"encounter_id": r["id"], "label": r["label"], "reasons": reasons})
    return jsonify({"flagged": flagged})


def _ai_draft(system, user, action, entity_id):
    """Shared AI-2/AI-4 helper: advisory Ollama draft, gated + audited."""
    from ai import config as _cfg
    if not _cfg.AI_ENABLED:
        return jsonify({"disabled": True, "advisory": True,
                        "draft": "AI is disabled in this deployment; draft manually."}), 200
    from ai import ollama_client as _oc
    res = _oc.chat([{"role": "system", "content": system}, {"role": "user", "content": user}])
    conn = db()
    audit(conn, auth.actor(), action, "ai", entity_id or 0, {"ok": res.get("ok")})
    conn.commit()
    return jsonify({"draft": res.get("content", ""), "ok": res.get("ok"), "advisory": True})


@app.post("/api/ai/mlc-narrative")   # AI-2
@auth.requires("mlc")
def ai_mlc_narrative():
    b = request.get_json(silent=True) or {}
    eid = b.get("encounter_id")
    conn = db()
    inj = [dict(x) for x in conn.execute(
        "SELECT region,wound_type,description FROM injury_note WHERE encounter_id=?", (eid,))]
    mlc = conn.execute("SELECT mlc_serial,mlc_type FROM mlc_case WHERE encounter_id=?", (eid,)).fetchone()
    notes = "; ".join(f"{i['region']}: {i['wound_type']} ({i['description'] or ''})" for i in inj) \
        or "no injuries recorded"
    return _ai_draft(
        "You draft a factual, neutral wound-certificate narrative for a physician to review, edit "
        "and sign. State only what the injury notes describe; never infer weapon, cause or intent "
        "beyond the notes. This is an ADVISORY draft only.",
        f"MLC {mlc['mlc_serial'] if mlc else ''} ({mlc['mlc_type'] if mlc else ''}). "
        f"Injury notes: {notes}. Draft the wound-certificate narrative.",
        "AI_MLC_NARRATIVE", eid)


@app.post("/api/ai/referral")   # AI-4
@auth.requires("dispose")
def ai_referral():
    b = request.get_json(silent=True) or {}
    eid = b.get("encounter_id")
    conn = db()
    enc = conn.execute("SELECT * FROM ed_encounter WHERE id=?", (eid,)).fetchone()
    p = _patient_dict(conn, enc["patient_id"]) if enc else None
    tri = conn.execute("SELECT * FROM triage_event WHERE encounter_id=? ORDER BY id DESC LIMIT 1",
                       (eid,)).fetchone()
    ctx = (f"Patient {(p or {}).get('name') or 'unknown'}, age {(p or {}).get('age_years')}. "
           f"Complaint: {tri['chief_complaint'] if tri else ''}. "
           f"Triage L{tri['final_level'] if tri else '?'}. "
           f"Vitals HR {tri['hr'] if tri else ''} SpO2 {tri['spo2'] if tri else ''} "
           f"SBP {tri['sbp'] if tri else ''}.")
    return _ai_draft(
        "Draft a structured inter-facility referral summary (reason for referral, clinical status, "
        "vitals, interventions given, specific request) for physician review before transmission. "
        "ADVISORY draft only; do not invent findings not provided.",
        ctx + " Draft the referral summary.", "AI_REFERRAL", eid)


# --- SPA shell --------------------------------------------------------
@app.get("/")
def index():
    if not auth.current_user():
        return redirect("/login")
    return render_template("index.html")


@app.get("/console")
def console():
    """The live, backend-wired SPA (hits the real Flask API + SQLite)."""
    return render_template("index.html")


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "favicon.svg",
                               mimetype="image/svg+xml")


def _db_is_empty():
    """True if ed.db is missing, 0 bytes, or has no seeded patients."""
    if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
        return True
    try:
        conn = sqlite3.connect(DB_PATH)
        n = conn.execute("SELECT COUNT(*) FROM patient").fetchone()[0]
        conn.close()
        return n == 0
    except sqlite3.Error:
        return True


if __name__ == "__main__":
    # A 0-byte ed.db shipped with earlier builds fooled the old `not exists`
    # check and left login crashing on a table-less DB. Seed on boot instead.
    if _db_is_empty():
        print("Database empty or missing — seeding demo data (python seed.py)…")
        subprocess.run([sys.executable, str(SCHEMA_PATH.parent / "seed.py")],
                       check=True, cwd=HERE)
    app.run(debug=True, port=5000)
