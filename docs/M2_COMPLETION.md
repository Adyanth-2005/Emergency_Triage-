# M2 Completion — Design Freeze (preserved & verified)

M2 was passed before this milestone; M3 **preserved** it intact and **verified** it still
holds. Nothing in the frozen contract was removed or weakened.

| M2 deliverable | Status | Evidence |
|---|---|---|
| Final ERD | ✔ preserved | `schema.sql`; ERD in `docs/ARCHITECTURE.md` |
| SQLite DDL from frozen models | ✔ preserved (additive columns only) | `schema.sql`; `_ensure_columns()` migration in `app.py` |
| API / route list | ✔ preserved, unchanged behaviour | frozen handlers in `app.py`; `test_e2e.py` 25/25 |
| ≤60s triage form wireframe | ✔ **built** in M3 | `static/js/app.js` `viewTriage()` |
| MLC register schema wireframe | ✔ **built** | `viewMlc()` / `viewMlcDetail()` |
| Tracking board wireframe | ✔ **built** | `viewBoard()` |
| Quick-reg + disposition wireframes | ✔ **built** | `viewRegister()`, `openDispositionModal()` |
| Deterministic seed | ✔ preserved + enriched | `seed.py` (fixed RNG 20260711) |
| Walking skeleton (boots, 1 flow e2e) | ✔ exceeded — **all** Phase-1 flows e2e | `test_m3.py` |

## Frozen invariants — re-verified

- Server-side validation on every POST — `test_e2e.py` §3 (silent override → 422).
- Suggestion recomputed server-side on submit (D-1) — `app.py:triage_commit`.
- Domain change + audit row in one transaction (D-2) — single `conn.commit()` per handler.
- Gapless MLC serials (D-3) — `test_e2e.py` §5.
- Unnatural death gated on MLC (D-5) — `schema.sql` CHECK + `test_e2e.py` §8 shape.
- Append-only, hash-chained audit — `test_e2e.py` §9/§10 (tamper detected).

## Fix applied during M3 (M2 §5 conformance)

M2 §5 promised _"every seeded action generates real hash-chained audit rows so the chain
verifier has content on first login."_ The shipped `seed.py` did not. M3 added a
deterministic `audit()` in `seed.py`, so a fresh seed now yields **19 verifiable chained
rows** covering QUICK_REG, TRIAGE, TRIAGE_OVERRIDE, MLC_OPEN, INTIMATION_LOG,
PHYSICIAN_ATTEND, DISPOSITION. `test_e2e.py` still passes 25/25.
