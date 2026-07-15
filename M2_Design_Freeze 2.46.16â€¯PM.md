# P5 — Emergency Triage: M2 Design Freeze

**Project**: P5 — Emergency Department Triage & Medico-Legal Workflow (PRD-05)
**Milestone**: M2 — Design freeze
**Date**: Sunday, 12 July 2026 (submitted early, 11 July)
**Gate rule**: no M3 build work begins until this is signed off
**Status**: Submitted for gate review

---

## 0. What is in this deliverable

| M2 requirement | Artefact | Status |
|---|---|---|
| Final ERD | §1 below + `schema.sql` | ✅ Frozen |
| SQLite DDL | `schema.sql` — 9 tables, 2 views, 2 triggers | ✅ Executes clean |
| API / route list | §2 below | ✅ Frozen |
| 3–5 screen wireframes | `wireframes.html` — **5 screens**, interactive | ✅ |
| Seeded sample dataset | `seed.py` — 6 synthetic patients, fixed RNG | ✅ Deterministic |
| Walking skeleton (app boots, 1 flow stubbed) | `app.py` + `test_e2e.py` | ✅ **Full flow runs, 25/25 tests pass** |

> The M2 bar is "app boots, one end-to-end flow stubbed." We cleared it: the
> complete path — unknown patient → triage → override → MLC → intimation →
> disposition — runs for real, with every compliance invariant enforced by the
> database rather than promised in a document.

---

## 1. Final ERD

Frozen from the M1 draft. Three changes made during DDL implementation, all documented below.

```
 patient ──1:N──▶ ed_encounter ──1:N──▶ triage_event
    │                  │                    (suggested_level + final_level
    │                  │                     BOTH stored; CHECK forces a
    │                  │                     reason when they differ)
    │                  │
    │                  ├──1:0..1──▶ mlc_case ──1:N──▶ police_intimation
    │                  │              (gapless serial            (constable name
    │                  │               via mlc_counter)           + badge MANDATORY)
    │                  │
    │                  └──1:0..1──▶ disposition
    │                                 (conditional payload per type,
    │                                  enforced by 6 CHECK constraints)
    │
    └── uhid NULL-able · temp_id NULL-able · name NULL-able
        CHECK(uhid IS NOT NULL OR temp_id IS NOT NULL)  ← the only identity rule

 triage_scale_config   (FR-1: the scale lives in DATA. AIIMS TP → ESI is an INSERT.)
 audit_log             (append-only, SHA-256 hash-chained, UPDATE/DELETE triggers)

 VIEWS
 v_tracking_board      elapsed time, breach flag, MLC badge — the board is a SELECT
 v_override_report     PRD-05 §11 "monthly to medical director" in one query
```

### Changes from the M1 draft (declare these at the gate)

| # | Change | Why |
|---|---|---|
| **Δ1** | Added `mlc_counter` table | `SELECT MAX(seq)+1` is racy. Two nurses triaging at 3 a.m. would collide and produce a duplicate serial — or worse, a gap. A single atomic `UPDATE … SET last_seq = last_seq + 1` inside the transaction makes gaplessness structural instead of hopeful. |
| **Δ2** | Moved `brought_by` from `mlc_case` to `ed_encounter` | Good Samaritans bring in non-MLC patients too. Attaching the field to the MLC record would have made "who brought you" a medico-legal question, which is precisely the chilling effect the MoRTH guidelines exist to prevent. |
| **Δ3** | Added 6 `CHECK` constraints on `disposition` for conditional payloads | A LAMA with no counselling record is not a LAMA, it is a liability. Enforcing this in Flask alone means one `curl` command bypasses it. |

---

## 2. API / Route List (frozen)

| Method | Route | FR | Contract |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness + audit-chain integrity |
| `POST` | `/api/quick-reg` | FR-2 | **Empty body must return 201.** Issues temp ID, opens encounter. Zero required fields — this is the Art. 21 contract, not an oversight. |
| `POST` | `/api/triage/suggest` | FR-1 | Dry-run the rules engine. Returns `suggested_level` + `reasons[]` + `vitals_missing[]`. Writes nothing. |
| `POST` | `/api/triage` | FR-1 | Commit. `422 override_reason_required` if `final_level ≠ suggested_level` without a ≥10-char reason. Both levels persisted. |
| `POST` | `/api/mlc` | FR-4 | Open MLC. Allocates gapless serial `MLC/<YYYY>/<NNNN>`. Sets `pocso_flag` for POCSO type — **no endpoint exists to unset it**. |
| `POST` | `/api/mlc/<id>/intimation` | FR-4 | Log the record-of-communication. `police_station`, `constable_name`, `constable_badge`, `mode` all mandatory. |
| `POST` | `/api/disposition` | FR-8 | **`409 mlc_intimation_pending`** if MLC with no intimation. Response carries `"blocking": false` and cites BNSS §194–196. Proceeds with a ≥10-char recorded justification. |
| `GET` | `/api/board` | FR-3* | Tracking board read model. *Phase 2 — view exists, screen not built. |
| `GET` | `/api/reports/overrides` | — | PRD-05 §11 monthly override report. |
| `GET` | `/api/audit/verify` | NFR | Recomputes the full hash chain. Returns `chain_intact` + `first_broken_row`. |

### The one response worth reading closely

```json
POST /api/disposition   →   409
{
  "error": "mlc_intimation_pending",
  "statutory_basis": "BNSS 2023 §194-196",
  "detail": "This is an MLC encounter with no police intimation logged.
             Log the intimation, or acknowledge and record a justification
             to proceed.",
  "blocking": false
}
```

`"blocking": false` is the most important field in the API.

We warn; we do not block. Blocking the discharge would mean the software holds a patient in the ED to protect its own compliance record — which inverts the entire point. Art. 21 and *Parmanand Katara* say care is never delayed by police formalities. So the patient always leaves. The silence just goes on the record, with a name and a timestamp attached to it.

That sentence is the answer to the viva question *"which rule forces this feature?"* — and it is the reason a `403` here would have been a bug wearing the costume of compliance.

---

## 3. Wireframes — `wireframes.html`

Five screens. Open the file in a browser; screens 1, 2 and 4 are interactive.

| # | Screen | FR | What to click at the gate |
|---|---|---|---|
| 01 | Quick registration | FR-2 | Every field is marked **optional** in green. Hit **Register & triage now** with nothing typed. It works. That is *Parmanand Katara* rendered in CSS. |
| 02 | Structured triage | FR-1 | Toggle red-flag chips — the suggestion moves live, and the panel always shows **why**. Pick a different final level: the override reason box appears and **Save** stays disabled until you justify it. |
| 03 | MLC register & intimation | FR-4 | Constable name and badge are marked required. The statute is printed on the screen, not buried in a manual. |
| 04 | Disposition | FR-8 + US-6 | **Click Discharge.** The MLC warning fires, cites BNSS §194–196, and demands a justification — while telling you plainly that it will not stop you. |
| 05 | Tracking board | FR-3 (Phase 2) | Wireframe only, **not built**. Note the `OVR 5→4` tag: every override is visible on the wall. |

**Design language**: dark ground, because these screens live on a wall in a room that is never fully lit and never fully dark. Acuity colour is the only saturated thing on screen — nothing else is permitted to compete with it. Vitals are set in monospace because they are read as digits, not prose.

---

## 4. Seeded Dataset — `seed.py`

Fixed RNG (`seed(20260711)`). Identical on every machine — a demo that renders differently on the examiner's laptop than on yours is a demo you cannot rehearse.

Six synthetic patients, chosen to exercise every demo branch:

| Patient | Level | Why they are in the set |
|---|---|---|
| **[UNKNOWN] TMP-2026-0001** | **1** | Unconscious RTA, Good Samaritan arrival. **MLC with intimation deliberately NOT logged** — this is what makes the US-6 warning fire live at M4 instead of being described in prose. |
| Meena Rajan | 2 | Stroke, FAST-positive — exercises the L2 red-flag path |
| Ramesh Kumar | 2 | Chest pain — second L2, so the board sorts within a level by arrival time |
| Arun Prasad | 3 | Assault — **MLC with intimation logged** (Constable R. Ramesh, badge TN-4471). The clean-MLC control case. |
| Suresh Iyer | 4 | **The override**: engine says L5, nurse says L4, reason recorded. Populates `v_override_report`. |
| Lakshmi Devi | 4 | Laceration — the ordinary case that makes the acute ones legible by contrast |

Two MLCs, one intimated, one pending. That asymmetry is deliberate demo architecture.

**DPDP discipline**: every name is invented. No real personal data enters the repo — the course rule and the Act agree.

---

## 5. Walking Skeleton — verified

`python test_e2e.py` → **25 passed, 0 failed.**

The tests that matter are not the happy paths:

| Test | Proves |
|---|---|
| Empty `POST /api/quick-reg` returns **201** | Art. 21. A validation error here would be a legal defect. |
| No vitals at all → still suggests L4, does not crash | Graceful degradation. A rule engine that demands a full vitals set is a rule engine the nurse abandons. |
| Override with no reason → **422** | US-2, enforced at the API *and* the schema |
| MLC serials are gapless `[1,2,3]` | BNSS §194–196. No holes for a defence lawyer to point at. |
| Half-filled LAMA → `IntegrityError` | The DB refuses it even if Flask is bypassed |
| `UPDATE audit_log` → **trigger aborts** | Append-only, enforced by SQLite |
| Tampered row → **chain breaks at row 2** | Tamper-*evident*. We cannot stop a DBA with write access from altering a row — we can guarantee that doing so is detectable. That is what the word has always meant. |
| Disposition on pending MLC → **409, `blocking: false`** | US-6. The showpiece. |

---

## 6. M3 Plan (build starts on sign-off)

M3 gate (14 Jul) requires: *"Triage with auto-suggested level + override works; quick-reg <10 s; MLC serial + police-intimation log; dispositions save."*

The backend for all four already passes tests. **M3 is therefore a UI-wiring sprint**, not a build-from-zero:

1. Wire screens 01–04 to the frozen routes (the routes will not move — that is what "freeze" means).
2. Instrument the two timing NFRs: quick-reg ≤10 s, triage form ≤60 s. Measure with a real stopwatch, not a guess; if the form misses 60 s, the form is wrong, not the target.
3. Known-gaps list + README.

**Not in M3**: tracking board (Phase 2), body-map, chain-of-custody, reporting engine, MCI mode, AI features.

---

## 7. Gate Request

Requesting M2 sign-off on: the frozen ERD (with Δ1–Δ3 declared), the ten-route API contract, the five wireframes, the deterministic seed, and the passing walking skeleton.

**Requesting permission to begin M3 build.**
