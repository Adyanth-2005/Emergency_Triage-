# Tech Stack

**One line:** Flask + SQLite (or Turso/libSQL) backend · a dependency‑free vanilla‑JS SPA
frontend · a local Ollama Advanced‑RAG AI layer — offline‑first, and the app runs on a
single `pip install flask`.

## Layers

| Layer | Technology | Why |
|---|---|---|
| Language | **Python 3.11** | stdlib `sqlite3`, `urllib`, `hashlib` → zero install for the core |
| Web framework | **Flask 3** (single `app.py`) | tiny, explicit, auditable; serves JSON API **and** HTML; the only runtime dependency |
| Database | **SQLite** file (`ed.db`), swappable to **Turso/libSQL** | single‑file + transactional locally; hosted libSQL for persistent serverless |
| DB seam | `db_backend.py` | one adapter: stdlib sqlite3 by default, libSQL when `LIBSQL_URL` is set — no per‑call code changes |
| Auth / RBAC | **Flask sessions** (`auth.py`) | signed cookie; salted‑SHA‑256 demo users; **server‑enforced** `@requires(perm)` |
| Rules engine | `triage_rules.py` (pure Python) | configurable AIIMS triage protocol — the explainable, deterministic core |
| Audit | SHA‑256 **hash‑chained** `audit_log` + append‑only triggers | tamper‑evident: editing history breaks every later hash |
| Frontend | **Vanilla JS SPA**, hash router, **no framework, no build** | offline NFR + auditability |
| 3D / motion | **Canvas 2D** "Vitals Field" (`lab.js`) | signature background, no WebGL/Three.js dependency |
| Charts | **hand‑rolled inline SVG** | donuts/bars with no chart library |
| Design system | `console.css` + `lab-theme.css` + `phosphor.css` | tokens; the void‑black `#7fee64` "command display" skin |
| AI | **local Ollama** Advanced RAG (`ai/`) | adaptive, cited, advisory; stdlib only (no numpy/faiss/langchain) |
| Deploy | **Vercel** (demo) · **Render/Fly** (disk) · **Turso** (persistent serverless) | `AI_ENABLED` + `ED_DB_PATH`/`LIBSQL_URL` env |
| Tests | Python stdlib + Flask test client | `test_e2e` (25) · `test_auth` (23) · `test_m3` (26) |

## Backend — `app.py`
Single flat module (no blueprints, for auditability): serves the SPA HTML (`/`, `/login`,
`/console`), the JSON API (`/api/quick-reg`, `/api/triage`, `/api/mlc`, `/api/disposition`,
`/api/board`, `/api/dashboard`, `/api/audit`, `/api/encounters/*`, `/api/ai/*`, `/api/health`),
and DB plumbing via `db_backend.connect()` with idempotent schema self‑heal + migration.
Every write is validated server‑side and RBAC‑gated; each domain change + its audit row
commit in **one transaction**.

## Database — `schema.sql`
9 tables (`patient`, `ed_encounter`, `triage_event`, `mlc_case`, `mlc_counter`,
`police_intimation`, `disposition`, `audit_log`, `triage_scale_config`) + 2 read‑model
views + append‑only triggers. Highlights: nearly all `patient` columns nullable
(treat‑first), triage stores **both** suggested and confirmed level, MLC serials **gapless**,
`audit_log` **hash‑chained** and append‑only. `db_backend.py` lets the exact same schema run
on stdlib SQLite or Turso/libSQL (a trigger‑aware `executescript` keeps the audit triggers intact).

## Auth & RBAC — `auth.py`
Session cookie (`secret_key`); 5 roles → permission sets; `@login_required` /
`@requires("triage")` enforce access **server‑side** (a receptionist `curl`‑ing
`POST /api/triage` gets **403**). The audited actor is derived from the **session**, never
the request body — so the tamper‑evident log can't be forged.

## Frontend — vanilla JS SPA
`templates/index.html` shell loads three stylesheets + `lab.js` (Canvas‑2D network field) +
`app.js` (hash‑router SPA rendering every screen via `fetch`) + `copilot.js` (the AI drawer).
No npm, no bundler, no framework. Charts are generated SVG strings.

## AI — local Ollama Advanced RAG (`ai/`)
- `ollama_client.py` — chat + embeddings + health over local Ollama via **stdlib `urllib`**.
- `knowledge.py` — policy/compliance corpus + auto‑ingests `docs/*.md`.
- `rag.py` — hybrid retrieval primitives (dense `nomic-embed-text` + hand‑rolled BM25 + RRF), cached index.
- `advanced.py` — the **AdvancedRAGPipeline**: query classification → adaptive routing →
  rewrite/decompose/multi‑query → hybrid + RRF → dedup → embedding rerank → extractive
  contextual compression → evidence evaluation → corrective retrieval (≤1) → context builder
  → grounded generation → **citation validation** → structured response. All feature‑flagged.
- `config.py` — every knob via env; `AI_ENABLED` is the mode switch.

Advisory‑only, offline (local Ollama), and every AI query is written to the audit chain.

## What's deliberately absent (and why)
- **No npm / bundler / framework** (React/Vue/Tailwind) — offline NFR, no build step.
- **No numpy / faiss / langchain / chromadb** — BM25, cosine and RRF are ~80 lines of stdlib; the vector index is a JSON‑cached embedding store.
- **No CDN / web fonts / external calls** — Ollama is *local*, so it fits the offline rule.
- Net result: the app needs **one dependency (Flask)**; Turso and Advanced‑RAG add only what their mode requires.

## File map
```
app.py                 API + HTML + DB plumbing + AI routes + health
auth.py                sessions, RBAC decorators, salted-hash users
db_backend.py          sqlite ↔ Turso/libSQL adapter (one seam)
triage_rules.py        AIIMS triage engine (advisory)
schema.sql             DDL: 9 tables, 2 views, audit triggers
seed.py                deterministic demo data + hash-chained audit rows
ai/                    config · ollama_client · knowledge · rag · advanced (Advanced RAG)
templates/             index.html (SPA) · login.html
static/css/            console.css · lab-theme.css · phosphor.css
static/js/             app.js (SPA) · lab.js (Vitals Field) · copilot.js (AI drawer)
api/index.py           Vercel serverless entry (read-only demo)
vercel.json            Vercel config (AI off, /tmp DB)
scripts/migrate_to_turso.py   SQLite → Turso migration (keeps the audit chain)
test_*.py              e2e (25) · auth (23) · m3 (26)
docs/                  DEPLOYMENT · ADVANCED_RAG · ARCHITECTURE · COMPLIANCE · KNOWN_GAPS …
```
