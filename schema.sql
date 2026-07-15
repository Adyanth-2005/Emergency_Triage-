-- =====================================================================
-- P5 — Emergency Department Triage & Medico-Legal Workflow (PRD-05)
-- M2 Design Freeze — SQLite DDL
-- Scope: FR-1 (triage), FR-2 (quick-reg), FR-4 (MLC), FR-8 (dispositions)
-- =====================================================================
--
-- DESIGN NOTE — READ BEFORE "FIXING" THE NULLABLE COLUMNS.
-- Almost every column on `patient` is nullable. This is not laziness.
-- Art. 21 + Parmanand Katara v. Union of India (SC 1989) mean emergency
-- care cannot be delayed for paperwork. A NOT NULL on patient.name is a
-- schema that breaks the law. Identity is enforced at RECONCILIATION,
-- never at CREATION.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- FR-1 : Configurable triage scale.
-- The scale lives in DATA, not in code. Swapping AIIMS TP -> adapted ESI
-- is an INSERT, not a rebuild. (PRD-05 §14 leaves the choice open;
-- Decision D-1 selects AIIMS TP.)
-- ---------------------------------------------------------------------
CREATE TABLE triage_scale_config (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    scale_name        TEXT    NOT NULL,              -- 'AIIMS_TP'
    level             INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    label             TEXT    NOT NULL,              -- 'Resuscitation'
    colour            TEXT    NOT NULL,              -- 'RED'
    max_wait_minutes  INTEGER NOT NULL,              -- 0 = immediate
    criteria_json     TEXT    NOT NULL,              -- vitals thresholds + red flags
    active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    UNIQUE (scale_name, level)
);

-- ---------------------------------------------------------------------
-- FR-2 : Quick registration. Treat-first, reconcile-later.
-- ---------------------------------------------------------------------
CREATE TABLE patient (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    uhid           TEXT    UNIQUE,        -- NULL until reconciled w/ PRD-01
    temp_id        TEXT    UNIQUE,        -- 'TMP-2026-0001' for unknowns
    name           TEXT,                  -- NULL: unconscious, no attender
    age_years      INTEGER CHECK (age_years IS NULL OR age_years BETWEEN 0 AND 130),
    sex            TEXT    CHECK (sex IS NULL OR sex IN ('M','F','O','UNKNOWN')),
    phone          TEXT,
    is_unknown     INTEGER NOT NULL DEFAULT 0 CHECK (is_unknown IN (0,1)),
    reconciled_at  TEXT,                  -- ISO-8601; NULL = still unidentified
    created_at     TEXT    NOT NULL,
    -- A patient must be findable by SOMETHING, even if that something is
    -- a machine-issued temp id. This is the only identity constraint.
    CHECK (uhid IS NOT NULL OR temp_id IS NOT NULL)
);
CREATE INDEX idx_patient_uhid    ON patient(uhid);
CREATE INDEX idx_patient_temp    ON patient(temp_id);
CREATE INDEX idx_patient_unknown ON patient(is_unknown) WHERE is_unknown = 1;

-- ---------------------------------------------------------------------
-- The ED encounter: arrival -> disposition. FHIR R4 Encounter(class=EMER).
-- ---------------------------------------------------------------------
CREATE TABLE ed_encounter (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id    INTEGER NOT NULL REFERENCES patient(id),
    arrival_ts    TEXT    NOT NULL,
    arrival_mode  TEXT    CHECK (arrival_mode IS NULL OR arrival_mode IN
                          ('WALK_IN','AMBULANCE_108','AMBULANCE_PRIVATE',
                           'POLICE','GOOD_SAMARITAN','REFERRED')),
    brought_by    TEXT,   -- OPTIONAL. Good Samaritan Guidelines (MoRTH 2016):
                          -- bystander details are optional and no Good
                          -- Samaritan may be detained. Nullable BY LAW.
    is_mlc        INTEGER NOT NULL DEFAULT 0 CHECK (is_mlc IN (0,1)),
    status        TEXT    NOT NULL DEFAULT 'ARRIVED'
                          CHECK (status IN ('ARRIVED','TRIAGED','IN_TREATMENT','CLOSED')),
    -- FR-3 door-to-doctor stamp (PRD-05 §2 NABH time-norm). Set when a
    -- physician attends; NULL until then. Additive M3 field — the triage
    -- flow froze at M2 without a door-to-doctor read model, but the KPI the
    -- tracking board points at needs a real timestamp, not a guess.
    first_physician_at TEXT,
    attended_by        TEXT,
    closed_ts     TEXT,
    CHECK (status <> 'CLOSED' OR closed_ts IS NOT NULL)
);
CREATE INDEX idx_enc_status  ON ed_encounter(status);
CREATE INDEX idx_enc_mlc     ON ed_encounter(is_mlc) WHERE is_mlc = 1;
CREATE INDEX idx_enc_arrival ON ed_encounter(arrival_ts);

-- ---------------------------------------------------------------------
-- FR-1 : The triage event itself.
-- Note suggested_level AND final_level are BOTH persisted. An override
-- never erases the machine's opinion — that is what turns PRD-05 §11's
-- VIP-pressure mitigation from a promise into a SQL query.
-- ---------------------------------------------------------------------
CREATE TABLE triage_event (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id     INTEGER NOT NULL REFERENCES ed_encounter(id),
    triaged_ts       TEXT    NOT NULL,
    chief_complaint  TEXT    NOT NULL,
    hr               INTEGER,   -- vitals nullable: a screaming child does not
    rr               INTEGER,   -- hold still for a full vitals set, and the
    sbp              INTEGER,   -- triage rules degrade gracefully on missing
    dbp              INTEGER,   -- values rather than blocking the nurse.
    spo2             INTEGER,
    temp_c           REAL,
    gcs              INTEGER CHECK (gcs IS NULL OR gcs BETWEEN 3 AND 15),
    red_flags_json   TEXT    NOT NULL DEFAULT '[]',
    suggested_level  INTEGER NOT NULL CHECK (suggested_level BETWEEN 1 AND 5),
    final_level      INTEGER NOT NULL CHECK (final_level BETWEEN 1 AND 5),
    override_reason  TEXT,
    triaged_by       TEXT    NOT NULL,
    -- The entire point of US-2, enforced in the schema rather than trusted
    -- to the UI: you cannot depart from the suggestion in silence.
    CHECK (final_level = suggested_level OR
           (override_reason IS NOT NULL AND length(trim(override_reason)) >= 10))
);
CREATE INDEX idx_triage_enc      ON triage_event(encounter_id);
CREATE INDEX idx_triage_override ON triage_event(encounter_id)
       WHERE override_reason IS NOT NULL;

-- ---------------------------------------------------------------------
-- FR-4 : MLC register. BNSS 2023 §194-196.
-- mlc_serial is UNIQUE and gapless. A statutory register with holes in it
-- is a courtroom problem, so allocation happens inside a transaction and
-- serials are never reused or skipped.
-- ---------------------------------------------------------------------
CREATE TABLE mlc_case (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id  INTEGER NOT NULL UNIQUE REFERENCES ed_encounter(id),
    mlc_serial    TEXT    NOT NULL UNIQUE,   -- 'MLC/2026/0001'
    mlc_year      INTEGER NOT NULL,
    mlc_seq       INTEGER NOT NULL,
    mlc_type      TEXT    NOT NULL CHECK (mlc_type IN
                    ('RTA','ASSAULT','POISONING','BURNS','SUSPECTED_FOUL_PLAY',
                     'SEXUAL_OFFENCE_POCSO','FIREARM','SUICIDE_ATTEMPT',
                     'INDUSTRIAL_ACCIDENT','UNNATURAL_DEATH','OTHER')),
    -- POCSO §19-21: non-reporting is itself a punishable offence. The flag
    -- is therefore not dismissible; the full prompt engine is FR-7/Phase 2,
    -- but the hook is here from day one.
    pocso_flag    INTEGER NOT NULL DEFAULT 0 CHECK (pocso_flag IN (0,1)),
    opened_ts     TEXT    NOT NULL,
    opened_by     TEXT    NOT NULL,
    UNIQUE (mlc_year, mlc_seq)
);
CREATE INDEX idx_mlc_serial ON mlc_case(mlc_serial);
CREATE INDEX idx_mlc_pocso  ON mlc_case(pocso_flag) WHERE pocso_flag = 1;

-- Counter table: makes gapless serial allocation a single atomic UPDATE
-- rather than a racy SELECT MAX(...) + 1.
CREATE TABLE mlc_counter (
    year      INTEGER PRIMARY KEY,
    last_seq  INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- FR-4 : Police intimation log. The record-of-communication.
-- PRD-05 §13 degraded mode: where no state e-portal exists, the statutory
-- duty is "met manually, evidenced digitally". This table IS the evidence.
-- ---------------------------------------------------------------------
CREATE TABLE police_intimation (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    mlc_case_id      INTEGER NOT NULL REFERENCES mlc_case(id),
    intimated_ts     TEXT    NOT NULL,
    police_station   TEXT    NOT NULL,
    constable_name   TEXT    NOT NULL,
    constable_badge  TEXT    NOT NULL,
    mode             TEXT    NOT NULL CHECK (mode IN
                       ('PHONE','WRITTEN','E_PORTAL','IN_PERSON')),
    ack_ref          TEXT,   -- portal ack / diary entry no.; NULL for phone
    logged_by        TEXT    NOT NULL
);
CREATE INDEX idx_intimation_mlc ON police_intimation(mlc_case_id);

-- ---------------------------------------------------------------------
-- FR-8 : Dispositions. One per encounter.
-- ---------------------------------------------------------------------
CREATE TABLE disposition (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id          INTEGER NOT NULL UNIQUE REFERENCES ed_encounter(id),
    type                  TEXT    NOT NULL CHECK (type IN
                            ('ADMIT','REFER_OUT','DISCHARGE','LAMA',
                             'DEATH','BROUGHT_DEAD')),
    decided_ts            TEXT    NOT NULL,
    decided_by            TEXT    NOT NULL,

    ward_requested        TEXT,   -- ADMIT      -> stub bed request (PRD-02)
    referral_facility     TEXT,   -- REFER_OUT
    referral_reason       TEXT,
    discharge_instr       TEXT,   -- DISCHARGE

    lama_counselled_by    TEXT,   -- LAMA / DOR
    lama_risks_explained  INTEGER CHECK (lama_risks_explained IS NULL OR
                                         lama_risks_explained IN (0,1)),
    lama_witness          TEXT,

    death_ts              TEXT,   -- DEATH / BROUGHT_DEAD
    cause_of_death_icd10  TEXT,   -- MCCD coding, RBD Act 1969
    mccd_form4_ref        TEXT,   -- Form 4 / 4A

    -- US-6 : disposing of an MLC encounter with no intimation logged is
    -- allowed ONLY with a recorded justification. We warn, we do not block
    -- clinical care — but the silence is on the record either way.
    mlc_warning_ack       INTEGER NOT NULL DEFAULT 0 CHECK (mlc_warning_ack IN (0,1)),
    mlc_warning_reason    TEXT,

    -- Conditional-payload integrity: each disposition type must carry its
    -- own mandatory fields. The DB refuses a half-filled LAMA.
    CHECK (type <> 'ADMIT'      OR ward_requested IS NOT NULL),
    CHECK (type <> 'REFER_OUT'  OR (referral_facility IS NOT NULL AND
                                    referral_reason   IS NOT NULL)),
    CHECK (type <> 'DISCHARGE'  OR discharge_instr IS NOT NULL),
    CHECK (type <> 'LAMA'       OR (lama_counselled_by   IS NOT NULL AND
                                    lama_risks_explained = 1)),
    CHECK (type NOT IN ('DEATH','BROUGHT_DEAD') OR
           (death_ts IS NOT NULL AND cause_of_death_icd10 IS NOT NULL)),
    CHECK (mlc_warning_ack = 0 OR
           (mlc_warning_reason IS NOT NULL AND
            length(trim(mlc_warning_reason)) >= 10))
);
CREATE INDEX idx_disp_type ON disposition(type);

-- ---------------------------------------------------------------------
-- PRD-05 §7 NFR (Audit): "every timestamp medico-legally defensible;
-- MLC records tamper-evident (hash-chained)".
-- Append-only. row_hash = SHA256(prev_hash || canonical_json(row)).
-- Break any historical row and every subsequent hash stops verifying.
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,   -- 'TRIAGE_OVERRIDE','MLC_OPEN','INTIMATION_LOG',...
    entity      TEXT NOT NULL,   -- 'triage_event','mlc_case',...
    entity_id   INTEGER,
    detail_json TEXT NOT NULL DEFAULT '{}',
    prev_hash   TEXT NOT NULL,
    row_hash    TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- Guard rails: the audit log is append-only. SQLite will not enforce that
-- by itself, so we forbid the two operations that would erase history.
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE forbidden');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only: DELETE forbidden');
END;

-- ---------------------------------------------------------------------
-- Convenience view: the ED tracking board (FR-3 is Phase 2, but the read
-- model costs nothing now and the wireframe needs something to point at).
-- ---------------------------------------------------------------------
CREATE VIEW v_tracking_board AS
SELECT
    e.id                                        AS encounter_id,
    COALESCE(p.name, '[UNKNOWN] ' || p.temp_id) AS display_name,
    COALESCE(p.uhid, p.temp_id)                 AS identifier,
    p.is_unknown,
    p.age_years,
    p.sex,
    e.arrival_mode,
    t.chief_complaint,
    t.final_level                               AS level,
    c.label                                     AS level_label,
    c.colour                                    AS level_colour,
    c.max_wait_minutes                          AS target_minutes,
    e.arrival_ts,
    t.triaged_ts,
    e.first_physician_at,
    e.is_mlc,
    m.mlc_serial,
    e.status,
    CAST((julianday('now') - julianday(e.arrival_ts)) * 1440 AS INTEGER)
                                                AS elapsed_minutes,
    CASE
      WHEN e.status = 'CLOSED' THEN 0
      WHEN CAST((julianday('now') - julianday(e.arrival_ts)) * 1440 AS INTEGER)
           > c.max_wait_minutes THEN 1
      ELSE 0
    END                                         AS is_breached
FROM ed_encounter e
JOIN patient p             ON p.id = e.patient_id
LEFT JOIN triage_event t   ON t.encounter_id = e.id
LEFT JOIN triage_scale_config c
       ON c.level = t.final_level AND c.active = 1
LEFT JOIN mlc_case m       ON m.encounter_id = e.id;

-- ---------------------------------------------------------------------
-- Compliance query for the viva: "show me every override last month."
-- PRD-05 §11 mitigation: "Override-with-reason logged and reported to
-- medical director monthly." One SELECT. That is the whole point.
-- ---------------------------------------------------------------------
CREATE VIEW v_override_report AS
SELECT
    t.triaged_ts,
    t.triaged_by,
    COALESCE(p.uhid, p.temp_id) AS identifier,
    t.suggested_level,
    t.final_level,
    CASE WHEN t.final_level > t.suggested_level
         THEN 'DOWNGRADED'   -- the direction that should worry you
         ELSE 'UPGRADED'
    END AS direction,
    t.override_reason
FROM triage_event t
JOIN ed_encounter e ON e.id = t.encounter_id
JOIN patient p      ON p.id = e.patient_id
WHERE t.override_reason IS NOT NULL
ORDER BY t.triaged_ts DESC;
