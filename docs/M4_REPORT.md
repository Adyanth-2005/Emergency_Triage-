# M4 Report — P5: Emergency Department Triage & Medico‑Legal Workflow

**Milestone:** M4 (Demo + Viva, 16 Jul) · **Graded scope:** FR‑1, 2, 4, 8 · **Repo:** github.com/Adyanth-2005/Emergency_Triage- · **Live:** ed‑triage‑snowy.vercel.app

## 1. What it is (in two lines)
A production‑style Emergency Department console: structured triage, treat‑first registration,
the Indian medico‑legal (MLC) workflow, and dispositions — with session auth + RBAC, a
tamper‑evident audit chain, and an optional local Advanced‑RAG AI copilot. All data synthetic.

## 2. What was built (graded scope FR‑1,2,4,8 — all ✅)
- **FR‑1 Structured triage** — configurable AIIMS‑TP 5‑level scale (data, not code), vitals
  capture, an **advisory** auto‑suggested level, nurse override with a **mandatory reason
  enforced by a DB `CHECK`** (not just the UI). ≤60 s two‑column form.
- **FR‑2 Quick registration** — treat‑first: an empty POST succeeds, issuing a temp ID; **no
  field blocks care** (Art. 21 / Parmanand Katara).
- **FR‑4 MLC module** — **gapless** statutory serial `MLC/YYYY/nnnn` (atomic counter), a
  police‑intimation log (time, constable name/badge, mode), POCSO non‑dismissible flag.
- **FR‑8 Dispositions** — Admit (→PRD‑02 stub), Refer‑out, Discharge, LAMA/DOR, Death /
  Brought‑dead (Form 4/4A, ICD‑10), each with per‑type mandatory fields enforced by `CHECK`.

**The M4 demo script — "triage 3 acuities → quick‑reg unknown → MLC + intimation →
admit/discharge/LAMA" — runs end‑to‑end.**

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
| POCSO §19‑21 | non‑dismissible POCSO flag + notice |
| NABH time‑norms | per‑level wait targets + breach flags on the board |
| MCCD / RBD Act 1969 | death disposition requires time + ICD‑10 cause (Form 4/4A) |
| Good Samaritan (MoRTH 2016) | optional bystander details, `GOOD_SAMARITAN` arrival mode |
| DPDP 2023 | synthetic data only; role‑gated access |

## 5. Verification
- **74 automated checks pass:** `test_e2e.py` (25, M2 invariants incl. tamper detection),
  `test_auth.py` (23, RBAC — a wrong role is refused), `test_m3.py` (26, flows + read models).
- Deterministic seed (`python seed.py`) → identical demo every run; hash chain verifies on first login.

## 6. Known gaps / honesty
The full PRD (FR‑3,5,6,7,9–14) is broader than the graded scope; those are documented in
`docs/KNOWN_GAPS.md` and are being added as an extension. The AI copilot is **local‑only**
(Ollama) and **advisory** — it never writes a clinical or statutory record; the hosted Vercel
demo runs with AI disabled and an ephemeral database by design.

## 7. How to run (viva)
`pip install -r requirements.txt` → `python seed.py` → `python app.py` → sign in
`doctor@hospital.com` / `password123`. Full local AI + Advanced‑RAG steps in `INSTRUCTIONS.md`;
demo walkthrough in `docs/DEMO_SCRIPT.md`.
