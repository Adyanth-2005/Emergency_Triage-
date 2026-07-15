# Advanced RAG (local, Ollama)

`ai/advanced.py` upgrades the base Hybrid RAG into an **adaptive** pipeline. Hybrid
retrieval (dense + BM25 + RRF) is preserved as one component; expensive techniques only
fire when the query class needs them, so simple questions stay fast.

## Pipeline
```
query
  → query intelligence: classify (FACTUAL / PROCEDURAL / COMPARATIVE / MULTI_HOP /
                                   SUMMARIZATION / NO_RETRIEVAL) + adaptive route
  → [ query rewrite · decomposition (≤3 sub-queries) · multi-query ]   (flagged)
  → hybrid retrieval: dense (nomic-embed-text) ∥ sparse (BM25) → Reciprocal Rank Fusion
  → deduplication (exact + near-duplicate, token Jaccard)
  → rerank (embedding-cosine; cross-encoder pluggable)
  → contextual compression (extractive, provenance preserved)
  → evidence evaluation (quality / coverage / source diversity)
  → corrective retrieval (rewrite + re-retrieve, ≤1 pass, only if evidence is weak)
  → context builder ([S1..Sn], token budget, per-document cap for diversity)
  → grounded generation (Ollama)
  → citation validation (drop any [S#] not in the retrieved set)
  → structured response
```

## Adaptive routing (examples)
- **Simple factual** → hybrid → rerank → generate (fast).
- **Multi-hop / comparative** → decompose → retrieve per sub-query → fuse → rerank → evaluate → generate.
- **Weak evidence** → rewrite → corrective retrieval → re-rank → re-evaluate → generate.

## Structured response
```json
{
  "answer": "...", "confidence": "High|Medium|Low",
  "citations": [{ "n": 1, "source_id": "S1", "title": "...", "section": "...", "chunk_id": "...", "snippet": "..." }],
  "query_processing": { "classification": "MULTI_HOP", "rewritten": false, "decomposed": true, "subquery_count": 2 },
  "retrieval": { "strategy": "ADVANCED_HYBRID", "fused_candidates": 40, "reranked_candidates": 6, "best_cos": 0.67 },
  "evidence": { "quality": "HIGH", "coverage_score": 0.65, "source_diversity": 6, "corrective_retrieval_used": false },
  "generation": { "provider": "ollama", "model": "gemma4:31b", "latency_ms": 22000 }
}
```

## Feature flags (`.env`)
`ENABLE_QUERY_CLASSIFICATION` · `ENABLE_QUERY_REWRITE` · `ENABLE_QUERY_DECOMPOSITION` ·
`ENABLE_MULTI_QUERY` (default off) · `ENABLE_HYDE` (default off) · `ENABLE_RERANKING` ·
`ENABLE_CONTEXTUAL_COMPRESSION` · `ENABLE_CORRECTIVE_RETRIEVAL` · `MAX_CORRECTIVE_ITERATIONS`
· `MAX_SUBQUERIES` · `RERANK_TOP_K` · `CONTEXT_TOKEN_BUDGET` · `DENSE_TOP_K` / `SPARSE_TOP_K` / `RRF_K`.

## Guarantees
- **Advisory only** — never writes a record, never assigns a triage level; the human decides.
- **Grounded + cited** — answers only from retrieved sources; unsupported → *"Insufficient evidence in the available knowledge base."*
- **Audited** — every query is a hash‑chained `AI_QUERY` row.
- **Offline** — local Ollama only; **graceful degradation** when it's off (BM25 still returns cited passages; the app is unaffected).

## Knowledge corpus
`ai/knowledge.py` (curated policy/compliance sources: Art. 21, BNSS §194‑196, POCSO, NABH
acuity, US‑6, audit chain, RBAC, MCCD…) **+** auto‑ingested `docs/*.md`. Embedded once with
`nomic-embed-text`, cached to `ai/index.json`.

## Not built (honest)
- **Cross‑encoder reranker** — current rerank is embedding‑cosine; a cross‑encoder is a pluggable drop‑in.
- **HyDE / multi‑query** — implemented but default‑off flags.
- **Parent‑child retrieval** — not implemented (optional).
- **ChromaDB** — intentionally avoided; the JSON‑cached embedding index keeps it dependency‑free.
