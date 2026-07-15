# M4 Report — P5: Emergency Department Triage & Medico‑Legal Workflow

**Milestone:** M4 (Demo + Viva, 16 Jul) · **Updated:** 15 Jul 2026 ·
**Graded scope:** FR‑1, 2, 4, 8 ( complete) · **Extension shipped:** FR‑3, 5, 6, 7, 9, 10, 11, 13, 14 + AI‑2/3/4/5 ·
**Repo:** github.com/Adyanth-2005/Emergency_Triage- · **Live:** ed‑triage‑snowy.vercel.app

## 1. What it is (in two lines)

A production‑style Emergency Department console: structured triage, treat‑first registration,
the Indian medico‑legal (MLC) workflow, and dispositions — with session auth + RBAC, a
tamper‑evident audit chain, and an optional local Advanced‑RAG AI copilot. All data synthetic.

## 2. FR checklist (PRD‑05 §6)

| FR | Requirement | Status | Evidence |
|---|---|---|---|
| FR‑1 | Structured triage — AIIMS‑TP 5‑level scale (config data, not code), vitals, advisory auto‑suggest recomputed server‑side, override reason enforced by DB `CHECK` | Done | `POST /api/triage`, `triage_rules.py` · `test_e2e` §2–4 |
| FR‑2 | Quick registration — treat‑first: empty POST succeeds, temp ID issued, nothing blocks care | Done | `POST /api/quick-reg` · `test_e2e` §1 |
| FR‑3 | ED tracking board — acuity, elapsed time, breach flags; door‑to‑doctor via `/attend`; bay allocation | Done | `GET /api/board`, `POST /attend`, `/bay` · `test_m3` §5 |
| FR‑4 | MLC module — gapless `MLC/YYYY/nnnn` serial (atomic counter), police‑intimation log (officer/badge/mode), POCSO non‑dismissible flag | Done | `POST /api/mlc`, `/intimation` · `test_e2e` §5 |
| FR‑5 | Injury documentation — body‑region + wound‑type templates, description, photo‑consent flag + photo reference | ◐ | `POST /api/encounters/<id>/injury` · `test_fr` |
| FR‑6 | Evidence chain‑of‑custody — item, collector, handed‑to officer/badge, signature ref; audited | Done | `POST /api/mlc/<id>/evidence` · `test_fr` |
| FR‑7 | Mandatory‑reporting engine — POCSO/IDSP/burns/poisoning matrix with statute citations; acknowledge requires recorded reason | Done | `reporting.py`, `/reporting`, `/reporting/ack` · `test_fr` |
| FR‑8 | Dispositions — all 6 types (Admit→PRD‑02 stub, Refer, Discharge, LAMA, DOR, Death/Brought‑dead with Form 4/4A + ICD‑10), per‑type mandatory fields via `CHECK`; US‑6 warn‑not‑block | Done | `POST /api/disposition` · `test_e2e` §6–8 |
| FR‑9 | Pre‑arrival intake — ambulance notification create/close, code activation | Done | `GET/POST /api/prearrival` · `test_fr` |
| FR‑10 | MCI/disaster mode — batch triage‑tag registration (Red/Yellow/Green/Black), MCI list | ◐ | `POST /api/mci/register`, `GET /api/mci` · `test_fr` |
| FR‑11 | Time‑critical pathway timers — tap‑to‑timestamp (door‑to‑ECG/needle/CT) | Done | `POST /api/encounters/<id>/timer` · `test_fr` |
| FR‑12 | Re‑triage — repeat assessments per encounter, reassessment‑due banner when the acuity window elapses, deterioration watch | ◐ | multiple `triage_event` rows, `reTriageBanner()` (app.js), `/api/ai/deterioration` |
| FR‑13 | ED analytics — door‑to‑doctor, LOS, LWBS, disposition mix, MLC volumes; monthly override report (§11) | Done | `GET /api/dashboard`, `/api/reports/overrides` · `test_m3` §4 |
| FR‑14 | Free‑treatment obligations — MV Act 2019 cashless / Good Samaritan entitlement tracking, optional bystander fields | Done | `POST /api/encounters/<id>/cashless` · `test_fr` |

\* FR‑5: photographs are stored as consent‑flagged **references**; in‑app image capture and a
visual (drawn) body map are not built — regions are structured fields. See §6.

**AI features (§10, advisory‑only):** AI‑1 guardrail honoured by the triage engine (suggests,
never assigns — `triage_rules.py`); AI‑2 MLC‑narrative and AI‑4 referral drafts
(`/api/ai/mlc-narrative`, `/api/ai/referral`, Ollama‑gated, audited); AI‑3 deterioration watch
(rule‑based, works with AI off); AI‑5 reportability checker (= FR‑7 engine, statute‑cited).

## 3. Why the key design decisions (compliance‑driven)

- **Treat‑first is the default path**, not an exception — the schema makes almost every
  `patient` column nullable, because a `NOT NULL` on `patient.name` would be a schema that
  breaks the law (emergency care cannot wait for paperwork).
- **The engine suggests; a human decides.** The suggestion is **recomputed server‑side** on
  submit, so the advisory‑only guarantee can't be bypassed by editing client JS. Both the
  suggested and confirmed level are stored → overrides are queryable and reported monthly
  (PRD‑05 §11).
- **The audit log is tamper‑evident** — every action is an append‑only, SHA‑256 hash‑chained
  row (`row_hash = SHA256(prev_hash + payload)`); editing history breaks every later hash, and
  triggers forbid UPDATE/DELETE (NFR §7). The actor is derived from the **session**, never the
  request body, so the log cannot be forged.
- **US‑6 warn‑not‑block** — disposing an MLC with no police intimation **warns** (HTTP 409,
  BNSS §194‑196) but never blocks care; the clinician proceeds with a recorded justification.
  Software must never hold a patient to protect its own compliance record (Art. 21).
- **Server‑enforced RBAC** — a nurse triages, a physician attends/disposes; a receptionist
  `curl`‑ing `POST /api/triage` gets **403**.

## 4. Compliance mapping (evidence in the app)

| Instrument | Where it's honored |
|---|---|
| Art. 21 / Parmanand Katara | treat‑first quick‑reg; US‑6 warn‑not‑block |
| BNSS 2023 §194‑196 | MLC serial + intimation log; disposition warning |
| POCSO §19‑21 | non‑dismissible POCSO flag; reporting matrix with recorded‑reason ack |
| NABH time‑norms | per‑level wait targets + breach flags on the board; pathway timers (FR‑11) |
| MCCD / RBD Act 1969 | death disposition requires time + ICD‑10 cause (Form 4/4A) |
| Good Samaritan (MoRTH 2016) | optional bystander details, `GOOD_SAMARITAN` arrival mode; FR‑14 tracking |
| MV Act 2019 (cashless/golden hour) | FR‑14 entitlement record per encounter |
| IDSP/IHIP | notifiable conditions in the FR‑7 matrix (form‑assist; no live API by design) |
| DPDP 2023 | synthetic data only; role‑gated access; photo‑consent flag on injury notes |

## 5. Verification

- **106 automated checks pass** (all suites green, verified 15 Jul from a clean seed):
  `test_e2e.py` (25, M2 invariants incl. tamper detection) · `test_auth.py` (23, RBAC —
  a wrong role is refused) · `test_m3.py` (26, flows + read models) · `test_fr.py`
  (32, FR‑5/6/7/9/10/11/14 + AI‑3, exercised through HTTP with real sessions).
- Deterministic seed (`python seed.py`) → identical demo every run; hash chain verifies on
  first login.
- The M4 demo script — "triage 3 acuities → quick‑reg unknown → MLC + intimation →
  admit/discharge/LAMA" — runs end‑to‑end (`docs/DEMO_SCRIPT.md`).

## 6. Known gaps / honesty

- **FR‑12 is partial**: re‑triage capture and a due‑for‑reassessment prompt exist, but there
  is no server‑side scheduler that escalates overdue reassessments on its own.
- **FR‑5**: no in‑app camera capture or drawn body‑map; injuries are structured
  region/wound‑type records with consent‑flagged photo references.
- **Patient reconciliation UI** not built (schema supports it — `reconciled_at`, temp IDs).
- **Demo credential store** — salted SHA‑256 in source; production needs bcrypt/argon2 + a
  user table.
- **External systems stubbed by design** — bed request logs `STUBBED -> PRD-02`; no
  ABDM/IHIP/police‑portal calls (PRD‑05 §13 fallbacks apply).
- Full list: `docs/KNOWN_GAPS.md`. The AI copilot is **local‑only** (Ollama) and **advisory**
  — it never writes a clinical or statutory record; the hosted Vercel demo runs with AI
  disabled and an ephemeral database by design.

## 7. How to run (viva)

`pip install -r requirements.txt` → `python seed.py` → `python app.py` → sign in
`doctor@hospital.com` / `password123`. Full local AI + Advanced‑RAG steps in `INSTRUCTIONS.md`;
demo walkthrough in `docs/DEMO_SCRIPT.md`.
