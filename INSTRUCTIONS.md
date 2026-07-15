# Instructions — Setup & Run

Two modes. Pick what you need.

- **Mode 2 — Full local stack** (app + Ollama + Advanced‑RAG copilot) → most complete.
- **Mode 1 — Application only** (AI off) → what deploys to Vercel.

Prerequisites: **Python 3.11+**. (Ollama only for the AI copilot; Node/Vercel CLI only to deploy.)

---

## Mode 2 — Full local stack (application + AI) ⭐

### 1. Install the app (one dependency)
```bash
cd ed-triage
python -m pip install -r requirements.txt      # Flask
```

### 2. Install Ollama + models (for the AI copilot)
Install Ollama from https://ollama.com, then pull the models:
```bash
ollama pull gemma4:31b            # generation (or llama3.1:8b for speed)
ollama pull nomic-embed-text      # embeddings for RAG
ollama serve                      # if it isn't already running
ollama list                       # confirm both models are present
```
> The console needs **one generation model** and **`nomic-embed-text`**. Any Ollama chat
> model works — set `ED_GEN_MODEL` to change it (see step 4).

### 3. Seed the database and run
```bash
python seed.py                    # deterministic demo data (idempotent)
python app.py                     # → http://127.0.0.1:5000   (AI_ENABLED defaults true)
```

### 4. Use it
- Open **http://127.0.0.1:5000** → sign in `doctor@hospital.com` / `password123`.
- **AI copilot:** press **Alt+A** (or the ✦ button in the top bar) and ask, e.g.
  *"For a road‑accident MLC, what must happen before discharge?"*
  The first answer with `gemma4:31b` takes ~1–2 min (model load); warm afterward.
- **Faster model** for a session:
  ```bash
  # PowerShell
  $env:ED_GEN_MODEL="llama3.1:8b"; python app.py
  # cmd.exe
  set ED_GEN_MODEL=llama3.1:8b && python app.py
  # bash
  ED_GEN_MODEL=llama3.1:8b python app.py
  ```

### 5. Configure (optional)
Copy `.env.example` → `.env` and tune. Key knobs:
```
AI_ENABLED=true
OLLAMA_HOST=http://localhost:11434
ED_GEN_MODEL=gemma4:31b
ED_EMBED_MODEL=nomic-embed-text
ENABLE_QUERY_DECOMPOSITION=true    # advanced-RAG feature flags
ENABLE_CONTEXTUAL_COMPRESSION=true
ENABLE_CORRECTIVE_RETRIEVAL=true
RERANK_TOP_K=6
```
The RAG index (`ai/index.json`) is built once from the policy corpus + `docs/*.md` and cached.

### AI health & troubleshooting
- Copilot header shows a **status dot** (green = Ollama online).
- "Ollama offline" → is `ollama serve` running? does `ollama list` show the models? is `OLLAMA_HOST` right?
- The app still works fully with Ollama off — AI just shows an unavailable state.

---

## Mode 1 — Application only (AI disabled)
Runs everywhere, no Ollama:
```bash
# PowerShell
$env:AI_ENABLED="false"; python app.py
# cmd.exe
set AI_ENABLED=false && python app.py
# bash
AI_ENABLED=false python app.py
```
Every non‑AI workflow works; `/api/ai/*` return a clean disabled state.

---

## Deploy to Vercel (Mode 1 demo)
```bash
npm i -g vercel
cd ed-triage
vercel login
vercel            # first deploy → prints a PREVIEW URL
vercel --prod     # → PRODUCTION URL
```
`vercel.json` already sets `AI_ENABLED=false` and `ED_DB_PATH=/tmp/ed.db`. On Vercel the
data lives in `/tmp` and is **ephemeral** (resets on cold start). For a **persistent**
deploy, use Turso or a disk host — see `docs/DEPLOYMENT.md`.

### Persistent deploy (optional) — Turso
```bash
turso db create ed-triage
turso db show ed-triage --url            # LIBSQL_URL
turso db tokens create ed-triage         # LIBSQL_AUTH_TOKEN
pip install -r requirements-turso.txt
export LIBSQL_URL=...  LIBSQL_AUTH_TOKEN=...
python seed.py && python scripts/migrate_to_turso.py
# then set LIBSQL_URL + LIBSQL_AUTH_TOKEN (+ AI_ENABLED=false) in Vercel env and redeploy
```

---

## Tests
```bash
python test_e2e.py     # 25
python test_auth.py    # 23
python test_m3.py      # 26
```

## Reset demo data
`python seed.py` (idempotent) — or, in the app, the sidebar role menu → **Reset demo data** (debug only).
