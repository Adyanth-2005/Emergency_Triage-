# Repository Audit — P5 Emergency Department Triage & Medico-Legal Console

_Audit performed before any code was modified, per Phase 0. This document is
the record of what existed at M2 and the plan that was then executed for M3._

---

## A. Detected project

**P5 — Emergency Department Triage & Medico-Legal Workflow (PRD-05).**

Evidence, unambiguous and convergent:

- `schema.sql` header: _"P5 — Emergency Department Triage & Medico-Legal Workflow (PRD-05)"_.
- Domain tables `triage_event`, `mlc_case`, `police_intimation`, `disposition`, `ed_encounter`.
- Statutory anchors throughout: BNSS 2023 §194-196, POCSO §19-21, Art. 21 / Parmanand Katara, NABH time-norms, MCCD Form 4/4A.
- `MILESTONE_M2.md` line 3: _"Project: P5 — Emergency Department Triage & Medico-Legal Workflow (PRD-05)"_.

This is **not** P1/P2/P3/P4/P6/P7. No patient-registration UHID logic, bed board,
OT scheduling, ICU allocation, staff roster, or generic dashboards project is present.

## B. Detected technology stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, Flask 3.x, single-module app (`app.py`) |
| Database | SQLite (stdlib `sqlite3`), schema in `schema.sql`, initialised by `seed.py` |
| Rules engine | Pure-Python `triage_rules.py` (configurable AIIMS Triage Protocol) |
| Audit | SHA-256 hash-chained append-only `audit_log` + append-only triggers |
| Tests | `test_e2e.py` (12 sections, compliance invariants) |
| Frontend (M2) | **None** — only a static `wireframes.html` design artefact |
| NFR | Offline-first (design decision D-7): no CDN, no web fonts, no external calls |

## C. Architecture summary (as found at M2)

```
app.py            Flask JSON API — health, quick-reg, triage suggest/commit,
                  MLC open, intimation, disposition, board, overrides, audit verify
triage_rules.py   AIIMS TP evaluate() — suggests a level + reasons; never assigns
schema.sql        9 tables, 2 views, 2 audit triggers, gapless MLC counter
seed.py           deterministic 6-patient demo (fixed RNG seed 20260711)
test_e2e.py       end-to-end + invariant proofs
wireframes.html   static M2 screen designs (not wired to anything)
ed.db             pre-built SQLite database
```

Cross-cutting invariants (frozen, verified): every POST is validated **server-side**
(client JS is convenience only); each domain change and its audit row commit in **one
transaction**; the triage suggestion is always **recomputed server-side** on submit;
the audit log is **append-only and hash-chained**; MLC serials are **gapless**.

## D. Existing M2 functionality (present + working)

- ✅ FR-2 Quick registration — treat-first, empty body succeeds (Art. 21), temp-ID issuance.
- ✅ FR-1 Triage — configurable rules engine, advisory suggestion with reasons, graceful degradation on missing vitals, override-reason enforced in schema `CHECK`.
- ✅ FR-4 MLC — gapless statutory serial allocation, POCSO flag, police-intimation log.
- ✅ FR-8 Dispositions — 6 types with per-type conditional-payload `CHECK` constraints; unnatural-death gated on MLC.
- ✅ US-6 showpiece — MLC + no intimation → disposition **warns (409) but never blocks** care; proceed only with a recorded ≥10-char justification.
- ✅ Hash-chained audit + tamper detection; append-only triggers.
- ✅ Override report view (PRD-05 §11) and tracking-board view.

## E. Incomplete for M3 (the gap this milestone closed)

M2 was explicitly a **walking skeleton** (M2 §6). The M3 checkpoint is _"all Phase-1
flows end-to-end"_. What was missing:

1. **No user interface at all** — the five frozen wireframes were never built.
2. No read models for a UI (encounter list, encounter hub, MLC detail, audit list, KPIs).
3. No door-to-doctor (FR-3) timestamp → the NABH KPI could not be computed.
4. `seed.py` wrote **no audit rows**, contradicting M2 §5 ("seeded actions generate audit rows").
5. No role context / RBAC surfacing; actor was an opaque string.
6. No demo-reset control; no dashboard; no explainable-AI presentation of the (already explainable) engine output.

## F. Bugs / defects found

- **Empty audit log after seed** — `seed.py` inserted domain rows directly, bypassing `audit()`, so the chain verifier had nothing to verify on first login (contradicts M2 §5). _Fixed._
- No functional defects in the frozen API; all 12 `test_e2e.py` sections passed as shipped.

## G. Security concerns

- No authentication/session layer (actor is a client-supplied string). Acceptable for the single-process MVP but **server-side RBAC is a documented gap** — see `docs/KNOWN_GAPS.md`.
- Serial allocation race is documented (D-3) and mitigated by the atomic counter UPDATE.
- Debug reloader must be off in production; demo-reset is guarded to debug-only.
- No secrets in repo; synthetic data only (DPDP discipline).

## H. UI/UX weaknesses

- The only UI artefact was a black-and-white static HTML wireframe — not usable, not responsive, not accessible, not wired to data.

## I. Database weaknesses

- Strong schema overall (FKs, CHECKs, indexes, unique gates). Only gap: no door-to-doctor stamp on `ed_encounter`. _Added additively via `ALTER TABLE ADD COLUMN` — no data loss._

## J. AI opportunities (chosen, honestly scoped)

- The triage engine is already **explainable AI** (suggestion + reasons + safe default). M3 surfaces it as an **advisory AIRecommendation card** with an **Evidence Confidence** signal and Accept/override recorded to audit.
- Deterministic, rule-based **operational insight** on the dashboard (breaches, pending intimations, unknown patients) — advisory, never autonomous.
- A full local Hybrid-RAG/LLM copilot is **architected but not built** this milestone (offline-NFR + scope). See `docs/KNOWN_GAPS.md` for the honest boundary — no fake chatbot, no hardcoded "AI" answers were added.

## K. Implementation plan (executed)

1. Preserve the entire M2 API unchanged; add **only additive** read/KPI endpoints + door-to-doctor `attend` + demo-reset + SPA route.
2. Additive schema migration for `first_physician_at` / `attended_by` (idempotent).
3. Enrich `seed.py` with door-to-doctor stamps, one disposition, and **real hash-chained audit rows**, keeping determinism and the passing `test_e2e.py`.
4. Build a premium, offline, accessible, 3D-animated **console UI** implementing every frozen wireframe and wiring every Phase-1 flow end-to-end.
5. Advisory/RBAC/explainability + audit viewer + dashboard.
6. Add `test_m3.py`; keep both suites green. Document everything.

### Files preserved / modified / created

- **Preserved (logic unchanged):** `triage_rules.py`, all frozen M2 API handlers in `app.py`, all `schema.sql` tables/constraints/triggers/views.
- **Modified (additive only):** `app.py` (+read models, KPIs, attend, demo-reset, SPA), `schema.sql` (+2 columns, +board view fields), `seed.py` (+audit rows, +door-to-doctor, +1 disposition).
- **Created:** `templates/index.html`, `static/css/console.css`, `static/js/app.js`, `static/favicon.svg`, `requirements.txt`, `test_m3.py`, `docs/*`, `.claude/launch.json`.
