# Known Gaps & Honest Boundaries

This project follows the rule: **no fake AI, no hardcoded "AI" answers, no broken buttons.**
Where something is not built, it is documented here rather than faked.

## 1. Server-side authentication & RBAC — **partial**

- **Shipped:** role context (nurse / physician / CMO / admin) that sets the recorded actor and **gates actions in the UI**; every action is attributed and audited.
- **Gap:** there is no login/session and permissions are **not enforced server-side** — a crafted `curl` could still call a handler with any actor string.
- **Why:** the frozen M2 schema has no `users`/session model; adding real auth is a schema change beyond the M3 "flows end-to-end" checkpoint. **Roadmap:** Flask-Login session + `@requires(role)` decorators on the write endpoints.

## 2. Local Hybrid RAG + LLM copilot — **architected, not built**

- **Shipped:** the triage engine is genuinely explainable AI, surfaced as an advisory `AIRecommendation` card with **Evidence Confidence**, evidence, and human confirmation → audit. Dashboard insight is deterministic and rule-based, clearly labelled.
- **Gap:** there is **no** dense/sparse retrieval, RRF, cross-encoder rerank, or LLM generation over a policy corpus. The full pipeline is diagrammed in `docs/ARCHITECTURE.md §4`.
- **Why:** (a) the offline NFR (D-7 — no CDN, no external calls, no model downloads) and (b) shipping a real, honest advisory layer was preferred over a fabricated chatbot. **Roadmap:** vendored `sentence-transformers/all-MiniLM-L6-v2` + FAISS + `rank-bm25` + RRF + optional `ms-marco-MiniLM` reranker, with graceful degradation when models are absent.

## 3. Patient reconciliation UI — **gap**

The schema supports reconciliation (`reconciled_at`, `is_unknown`) and the identity rule
is frozen (D-4: unknowns keep their `TMP-…` code). A dedicated reconcile screen/endpoint is
not built. **Roadmap:** `POST /api/patients/<id>/reconcile` + a hub action, audited with
before/after.

## 4. External-system stubs

Bed request on ADMIT is stubbed to PRD-02 (`"STUBBED -> PRD-02"`), matching PRD-05 §13
("phone-based admission continues"). No ABDM/ABHA/PMJAY/police-portal calls exist — by
design, and would be **mock/stub only** if added.

## 5. Serial-allocation race (documented at M2, D-3)

Gapless serials use an atomic counter UPDATE — correct for the single-process MVP. A
multi-process deployment would need a stronger allocation strategy.

## 6. RAG evaluation harness — **gap**

Advisory-engine behaviour is asserted in the test suites; a standalone `evaluation/`
harness (retrieval relevance, groundedness, unsupported-claim checks) belongs with item 2.
