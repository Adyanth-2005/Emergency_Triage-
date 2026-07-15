"""
Local, advisory AI for the ED console — Ollama-backed Hybrid RAG.

Design contract (unchanged from the rest of the product):
  * ADVISORY ONLY — the LLM explains and summarises grounded in the policy
    corpus + live data. It never writes a clinical or statutory record.
  * OFFLINE — talks only to a LOCAL Ollama (localhost), no CDN, no cloud.
  * GRACEFUL DEGRADATION — if Ollama is down the whole app still works;
    AI endpoints return a `degraded` flag and the UI shows an offline state.
  * DEPENDENCY-FREE — stdlib only (urllib for HTTP, hand-rolled BM25 +
    cosine + Reciprocal Rank Fusion). No numpy, no langchain, no faiss.
"""
