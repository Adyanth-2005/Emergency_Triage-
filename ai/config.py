"""AI configuration — all overridable by environment variables."""
import os


def _flag(name, default):
    return os.environ.get(name, str(default)).strip().lower() not in ("0", "false", "no", "off", "")


# ---- AI service boundary -------------------------------------------------
# The single switch that separates MODE 1 (Vercel / AI-off) from MODE 2
# (full local stack). When false, the app makes zero calls to Ollama and the
# /api/ai/* endpoints return a clean "disabled" state — nothing breaks.
AI_ENABLED = _flag("AI_ENABLED", True)

# ---- Adaptive Advanced-RAG feature flags (only fire when useful) ---------
ENABLE_QUERY_CLASSIFICATION  = _flag("ENABLE_QUERY_CLASSIFICATION", True)
ENABLE_QUERY_REWRITE         = _flag("ENABLE_QUERY_REWRITE", True)
ENABLE_QUERY_DECOMPOSITION   = _flag("ENABLE_QUERY_DECOMPOSITION", True)
ENABLE_MULTI_QUERY           = _flag("ENABLE_MULTI_QUERY", False)
ENABLE_HYDE                  = _flag("ENABLE_HYDE", False)
ENABLE_RERANKING             = _flag("ENABLE_RERANKING", True)
ENABLE_CONTEXTUAL_COMPRESSION = _flag("ENABLE_CONTEXTUAL_COMPRESSION", True)
ENABLE_CORRECTIVE_RETRIEVAL  = _flag("ENABLE_CORRECTIVE_RETRIEVAL", True)
MAX_CORRECTIVE_ITERATIONS    = int(os.environ.get("MAX_CORRECTIVE_ITERATIONS", "1"))
MAX_SUBQUERIES               = int(os.environ.get("MAX_SUBQUERIES", "3"))
RERANK_TOP_K                 = int(os.environ.get("RERANK_TOP_K", "6"))
CONTEXT_TOKEN_BUDGET         = int(os.environ.get("CONTEXT_TOKEN_BUDGET", "1800"))

OLLAMA_HOST   = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
# Gemma 4 (31B) — higher-quality grounded answers; slower first token than 8B.
# Override with ED_GEN_MODEL (e.g. "llama3.1:8b" for faster responses).
GEN_MODEL     = os.environ.get("ED_GEN_MODEL", "gemma4:31b")
EMBED_MODEL   = os.environ.get("ED_EMBED_MODEL", "nomic-embed-text")

GEN_TIMEOUT   = float(os.environ.get("ED_GEN_TIMEOUT", "180"))
EMBED_TIMEOUT = float(os.environ.get("ED_EMBED_TIMEOUT", "45"))
HEALTH_TIMEOUT = 3.0

# Retrieval knobs
CHUNK_WORDS   = 170
CHUNK_OVERLAP = 40
DENSE_K       = 8      # dense (vector) shortlist
SPARSE_K      = 8      # sparse (BM25) shortlist
FUSION_K      = 5      # chunks kept for the grounded context
RRF_K         = 60     # Reciprocal Rank Fusion constant
MIN_SCORE     = 0.20   # below this best-cosine, we say "insufficient evidence"

GEN_TEMPERATURE = 0.15
