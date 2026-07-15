# Deployment & Operating Modes

This project runs in two clearly separated modes. The **application** and the
**local AI** are architecturally decoupled by a single switch: `AI_ENABLED`.

```
                    USERS
                      │
              ┌───────┴────────┐
              │   THE APP       │  Flask + SQLite + vanilla-JS SPA
              │  (Vercel-able)  │  login · dashboard · board · triage ·
              └───────┬────────┘  MLC · audit · dispositions
                      │  AI_ENABLED=false ─────────────┐  (MODE 1)
                      │  AI_ENABLED=true                │
              ┌───────┴────────┐                        │
              │  LOCAL AI       │  NOT on Vercel         │
              │  Ollama +       │                        ▼
              │  Advanced RAG   │                 clean "AI disabled"
              └────────────────┘                        state
```

## MODE 1 — Application (AI off) · Vercel-deployable *demo*
`AI_ENABLED=false`. The app makes **zero** calls to Ollama; `/api/ai/*` return a
clean disabled state; every non-AI workflow works. `/api/health` never depends
on AI.

### Two Vercel options — ephemeral demo, or genuinely persistent (Turso)
Vercel's Python runtime is **stateless** with a **read-only filesystem except
`/tmp`** (wiped between cold starts). The app's core value is a **persistent,
tamper-evident audit chain** plus live writes, so pick one:

**Option A — read-only demo (no database service).** `api/index.py` seeds the
deterministic dataset into `/tmp/ed.db` on cold start. UI + read flows work;
**writes do not persist**. Zero setup — just deploy.

**Option B — persistent on Vercel via Turso (recommended for a real deploy).**
Turso is a hosted libSQL (SQLite-compatible) database. The app switches to it
automatically when `LIBSQL_URL` is set — the audit chain and every write persist
across invocations. Setup:
```bash
# 1. create the database (Turso CLI)
turso db create ed-triage
turso db show ed-triage --url            # -> LIBSQL_URL
turso db tokens create ed-triage         # -> LIBSQL_AUTH_TOKEN

# 2. push schema + your seeded data (preserves the audit hash-chain)
pip install -r requirements-turso.txt
python seed.py                           # ensure local ed.db exists
export LIBSQL_URL="libsql://ed-triage-<org>.turso.io"
export LIBSQL_AUTH_TOKEN="<token>"
python scripts/migrate_to_turso.py

# 3. set the same two vars (+ AI_ENABLED=false) in Vercel project settings, deploy
```
The DB seam is `db_backend.py`: stdlib `sqlite3` locally, libSQL when `LIBSQL_URL`
is set — **no per-call code changes**. Alternatively, deploy the whole app to a
host with a disk (**Render / Railway / Fly.io**) and set `ED_DB_PATH` to a mounted
volume — also fully persistent, no Turso needed.

### Deploy the demo to Vercel
```bash
npm i -g vercel
vercel            # first deploy (uses vercel.json + api/index.py)
vercel --prod
```
`vercel.json` sets `AI_ENABLED=false` and `ED_DB_PATH=/tmp/ed.db`, routes
`/static/*` to static assets and everything else to the Flask WSGI app.

### Why Ollama / the vector index are **not** on Vercel
- **Ollama** is a long-running local inference server (multi-GB models); serverless functions are short-lived and can't host it.
- The **embedding index** (`nomic-embed-text` vectors cached to `ai/index.json`) and BM25 are built in-process on a writable disk — not available on Vercel's read-only FS. (This project uses a lightweight local index, not ChromaDB; ChromaDB is a pluggable option but intentionally avoided to stay dependency-free.)

## MODE 2 — Full local stack (Advanced RAG copilot)
`AI_ENABLED=true` + a local Ollama. This enables the **Advanced RAG** copilot.

```bash
# 1. models (one-time)
ollama pull gemma4:31b            # or llama3.1:8b for speed
ollama pull nomic-embed-text

# 2. run the app
python -m pip install -r requirements.txt
python seed.py
python app.py                     # http://127.0.0.1:5000  (AI_ENABLED defaults true)
```
Open the app → sign in → **Alt+A** (or the ✦ top-bar button) for the copilot.

## Advanced RAG pipeline (MODE 2)
`ai/advanced.py` — adaptive, so simple questions stay fast:
```
query → classify (FACTUAL/PROCEDURAL/COMPARATIVE/MULTI_HOP/SUMMARIZATION/NO_RETRIEVAL)
      → adaptive route → [rewrite · decompose · multi-query]
      → hybrid retrieval (dense nomic-embed-text + BM25) → RRF → dedup
      → embedding rerank → extractive contextual compression
      → evidence evaluation → corrective retrieval (≤1 pass, if weak)
      → diversity-aware context builder ([S1..Sn] + provenance + token budget)
      → grounded Ollama generation → citation validation → structured response
```
Every expensive step is a feature flag (`ENABLE_*` in `.env.example`). Response
includes `query_processing`, `retrieval`, `evidence`, `sources`, `generation`.
All AI use is advisory-only and written to the audit chain as `AI_QUERY`.

## Environment variables
See [`.env.example`](../.env.example). Key ones:
| Var | Purpose |
|---|---|
| `AI_ENABLED` | **the mode switch** — false on Vercel, true locally |
| `ED_DB_PATH` | DB location (`/tmp/ed.db` on serverless; a volume path on Render/Fly) |
| `ED_SECRET_KEY` | session signing key (set in production) |
| `OLLAMA_HOST` / `ED_GEN_MODEL` / `ED_EMBED_MODEL` | local AI (MODE 2 only) |
| `ENABLE_*`, `RERANK_TOP_K`, `MAX_SUBQUERIES`, … | Advanced RAG tuning |

Never put real secrets in client-exposed variables (this SPA reads none).

## Health
- `GET /api/health` — app health; **never** fails because AI is offline. Returns `{status, audit_chain_intact, ai_enabled}`.
- `GET /api/ai/health` — AI/Ollama status (or `{disabled:true}` when `AI_ENABLED=false`).

## Troubleshooting
- **Copilot says "Ollama offline"** → `ollama serve` running? `ollama list` shows the models? `OLLAMA_HOST` correct?
- **Vercel writes don't stick** → expected (read-only demo). Use Render/Fly/Turso for persistence.
- **First AI answer slow** → the large model loads on first call (~1–2 min for 31B); warm afterward. Use `ED_GEN_MODEL=llama3.1:8b` for speed.
