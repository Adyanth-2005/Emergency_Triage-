<div align="center">

#  ED Triage Console — **The Living Ward**

### P5 · Emergency Department Triage & Medico‑Legal Workflow (PRD‑05)

A premium, offline‑first hospital command‑center for emergency triage and the Indian
medico‑legal (MLC) workflow — session auth + RBAC, a phosphor "command display" UI, a
tamper‑evident audit chain, and an **optional local Advanced‑RAG AI copilot**.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/DB-SQLite%20%C2%B7%20Turso-003B57?logo=sqlite&logoColor=white)
![AI](https://img.shields.io/badge/AI-Ollama%20Advanced%20RAG-7fee64?logoColor=black)
![Deploy](https://img.shields.io/badge/deploy-Vercel%20%C2%B7%20Render%20%C2%B7%20Fly-000000?logo=vercel)
![Tests](https://img.shields.io/badge/tests-74%20passing-2fa36b)

</div>

---

## What it is
An emergency department must **treat first and reconcile identity later** (Art. 21 /
*Parmanand Katara*, SC 1989), assign clinical acuity in seconds, and — when a case is
medico‑legal — meet statutory police‑intimation duties (BNSS 2023 §194‑196, POCSO §19‑21)
with a **court‑defensible, tamper‑evident** record. This console delivers that end‑to‑end:
quick registration → **≤60s triage** (advisory suggestion, human‑confirmed) → tracking
board → physician attend → MLC + intimation → disposition → **hash‑chained audit trail**.

> **Data:** 100% synthetic. **AI:** advisory‑only — it explains, the human decides.

## Two operating modes
The **application** and the **local AI** are decoupled by one switch, `AI_ENABLED`.

| Mode | `AI_ENABLED` | What runs | Where |
|---|---|---|---|
| **1 · Application** | `false` | full app, AI cleanly disabled, zero Ollama calls | **Vercel / Render / Fly / local** |
| **2 · Full local stack** | `true` | app **+** Ollama **+** Advanced‑RAG copilot | local machine |

The app **never crashes** when AI is offline — `/api/ai/*` return a clean "disabled" state.

## Quick start — full local stack (Mode 2)
```bash
python -m pip install -r requirements.txt      # just Flask
python seed.py                                 # deterministic demo data
python app.py                                  # → http://127.0.0.1:5000
```
Sign in with `doctor@hospital.com` / `password123`. For the **AI copilot**, have Ollama
running (`ollama pull gemma4:31b` + `ollama pull nomic-embed-text`) and press **Alt+A**.
Full steps: **[INSTRUCTIONS.md](INSTRUCTIONS.md)**.

## Deploy the demo to Vercel (Mode 1, read‑only)
```bash
npm i -g vercel
cd ed-triage
vercel            # → preview URL
vercel --prod     # → production URL
```
`vercel.json` sets `AI_ENABLED=false` + `ED_DB_PATH=/tmp/ed.db`; `api/index.py` seeds the
demo into `/tmp` on cold start. **Writes are ephemeral** on Vercel serverless — for a
persistent deploy use **Turso** (`LIBSQL_URL`) or a disk host. See
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Login accounts (all `password123`)
| Email | Role | Can |
|---|---|---|
| `doctor@hospital.com` | Physician | register, triage, attend, dispose, MLC, intimation |
| `nurse@hospital.com` | Triage Nurse | register, triage |
| `cmo@hospital.com` | CMO | MLC, intimation |
| `reception@hospital.com` | Receptionist | register, view board |
| `admin@hospital.com` | Administrator | everything |

## Features
Session auth + **server‑enforced RBAC** · **≤60s triage** with advisory suggestion +
Evidence Confidence · tracking board with acuity spines + breach pulse · MLC register +
gapless serials + police‑intimation log · type‑driven disposition with the **US‑6**
warn‑not‑block rule · **hash‑chained audit trail** + override report · command palette
(⌘/Ctrl‑K) · **phosphor "command display"** design (void‑black, `#7fee64`, animated
network background) · WCAG‑AA · responsive.

## AI — local Advanced RAG (Mode 2)
`ai/advanced.py` — adaptive: simple questions stay fast, complex ones get the full path.
```
classify → adaptive route → [rewrite · decompose · multi-query]
→ hybrid retrieval (dense nomic-embed + BM25) → RRF → dedup → embedding rerank
→ contextual compression → evidence evaluation → corrective retrieval (≤1)
→ context builder [S1..Sn] → grounded Ollama generation → citation validation
```
Advisory‑only, cited, confidence‑labelled, and **audited** as `AI_QUERY`. Every expensive
step is a feature flag. Details in **[docs/ADVANCED_RAG.md](docs/ADVANCED_RAG.md)**.

## Tech stack
Flask + SQLite (or Turso/libSQL) backend · dependency‑free vanilla‑JS SPA · Canvas‑2D
"Vitals Field" + inline‑SVG charts · local Ollama Advanced‑RAG (stdlib only). Full
breakdown in **[TECH_STACK.md](TECH_STACK.md)**.

## Testing
```bash
python test_e2e.py     # M2 invariants (25)
python test_auth.py    # auth / RBAC (23)
python test_m3.py      # M3 flows / read models (26)
```
**74 checks, all passing.**

## Docs

- [INSTRUCTIONS.md](INSTRUCTIONS.md) — setup & run (local full‑AI stack **+** Vercel)
- [TECH_STACK.md](TECH_STACK.md) — architecture & technology choices
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel demo **+** persistent (Turso) deploy
- [docs/ADVANCED_RAG.md](docs/ADVANCED_RAG.md) — the adaptive Advanced‑RAG pipeline
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system, ERD & workflow diagrams
- [docs/COMPLIANCE.md](docs/COMPLIANCE.md) — statutory & clinical compliance mapping
- [docs/KNOWN_GAPS.md](docs/KNOWN_GAPS.md) — honest limitations & roadmap

<sub>More: [AI_ADVISORY](docs/AI_ADVISORY.md) · [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) · [DESIGN_SKIN](docs/DESIGN_SKIN.md) · [FINAL_VERIFICATION](docs/FINAL_VERIFICATION.md) · [M2_COMPLETION](docs/M2_COMPLETION.md) · [M3_COMPLETION](docs/M3_COMPLETION.md) · [REPOSITORY_AUDIT](docs/REPOSITORY_AUDIT.md)</sub>

## License
MIT. All patient data is synthetic; no real personal data is used.
