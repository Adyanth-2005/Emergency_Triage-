# AI — Advisory-Only Architecture

## Principle

The AI/engine **suggests**; a human **confirms**; the confirmation is **audited**. No AI
output ever mutates a clinical or statutory record. This is enforced structurally, not by
policy alone:

1. The triage suggestion is computed by `triage_rules.evaluate()` and returned by
   `POST /api/triage/suggest` — a pure function that **writes nothing**.
2. On commit, `POST /api/triage` **recomputes the suggestion server-side** and takes the
   nurse's `final_level` as authoritative. If it differs, an override reason (≥10 chars) is
   **required by a schema `CHECK`** — a JavaScript-only rule would be deleted by a `curl`.
3. The domain row **and** its hash-chained audit row commit in **one transaction**.

## What the UI shows (the `AIRecommendation` pattern)

Each advisory card carries:

- **Recommendation** — the suggested level + human-readable label.
- **Evidence Confidence** — High / Medium / Low, with the **reason** it was assigned
  (red-flag/vital convergence, missing-vitals count, or safe-default). Explicitly **not**
  claimed to be a calibrated probability.
- **Evidence list** — the exact reasons the engine fired (e.g. `red flag: chest_pain_ischaemic`, `spo2 = 88`).
- **Timestamp / operator** — recorded on confirmation.
- **Human controls** — the 3D level picker is the accept/override act; override requires a reason.

## Evidence-confidence rule (transparent)

| Condition | Level |
|---|---|
| No rule matched → safe default (L4) | **Low** — "clinician judgement should lead" |
| ≥1 red flag and suggested ≤ L2, or ≥3 total criteria | **High** |
| ≥4 vitals missing | **Medium** — "confirm on assessment" |
| otherwise | **Medium** |

Implemented in `evidenceConfidence()` (`static/js/app.js`) — deterministic and inspectable.

## Guardrails present today

- Advisory boundary is **server-enforced** (recompute on submit).
- Structured, validated inputs; safe default is toward **over-triage** (under-triage kills).
- Every AI-adjacent action is written to the **tamper-evident** chain.

## Not built (documented, not faked)

No LLM, no retrieval, no generated prose is presented as fact. See
`docs/KNOWN_GAPS.md` for the Hybrid-RAG roadmap and the reason (offline NFR + scope).
