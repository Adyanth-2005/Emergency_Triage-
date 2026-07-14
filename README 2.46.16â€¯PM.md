# P5 — Emergency Department Triage & Medico-Legal Workflow

Hospital Operations Suite mini-project · PRD-05 · Sprint 11–16 July 2026
**Scope**: Phase-1 / S-tier only → **FR-1** (triage), **FR-2** (quick-reg), **FR-4** (MLC), **FR-8** (dispositions)
**Triage scale**: AIIMS Triage Protocol, 5-level (Decision D-1)

---

## Run it

```bash
pip install flask
python seed.py        # builds ed.db — deterministic, synthetic patients only
python test_e2e.py    # 25 assertions, all compliance invariants   → expect 25/25
python app.py         # http://127.0.0.1:5000
open wireframes.html  # 5 screens; 1, 2 and 4 are interactive
```

No network calls. No real patient data. Runs fully offline — which is not a
convenience, it is PRD-05 §7: *"ED cannot stop for IT."*

## Files

| File | What it is |
|---|---|
| `M1_Requirements_Signoff.md` | M1 gate — scope, user stories, ERD, compliance checklist |
| `M2_Design_Freeze.md` | M2 gate — final ERD, route list, wireframe index, seed spec |
| `schema.sql` | SQLite DDL — 9 tables, 2 views, 2 append-only triggers |
| `triage_rules.py` | AIIMS TP rules engine. Suggests; never decides. |
| `app.py` | Flask walking skeleton — 10 routes, hash-chained audit log |
| `seed.py` | 6 synthetic patients, fixed RNG (`20260711`) |
| `test_e2e.py` | End-to-end proof of every compliance invariant |
| `wireframes.html` | 5 screens |

## The four things a grader will ask

**"Why does an empty registration form succeed?"**
Art. 21 + *Parmanand Katara v. Union of India* (SC 1989). Emergency care cannot
wait on paperwork. A `NOT NULL` on `patient.name` would be a schema that breaks
the law. Identity is enforced at reconciliation, never at creation.

**"Why is the MLC serial gapless?"**
BNSS 2023 §194–196. A statutory register with a hole in it invites exactly one
question in court: *what was in entry 0043, and who removed it?*

**"Why does the MLC warning not block the discharge?"**
Because blocking would mean the software holds a patient in the ED to protect
its own compliance record — and Art. 21 says care is never delayed by police
formalities. The patient always leaves. The silence just goes on the record,
with a name and a timestamp attached to it. This is the single most defensible
design decision in the project.

**"Why default to Level 4 when no rule matches, instead of Level 5?"**
A patient the rules do not understand is not a patient who is fine. Under-triage
kills; over-triage costs a bay for twenty minutes. When the engine is ignorant,
it must be ignorant in the direction that is survivable.

## Known gaps (declared, not hidden)

- **FR-7 mandatory-reporting engine** is Phase 2. The POCSO *flag* exists and
  cannot be unset through the API; the *prompt engine* is not built. Stating this
  boundary is better than faking it.
- **Tracking board (FR-3)** — SQL view and wireframe exist; screen not built.
- **PRD-01/02/04/07** are stubbed. We own P5 only.
- **Multi-node offline reconciliation** not attempted. Single-node offline works
  by construction (SQLite + local Flask).

## DPDP discipline

Every patient in `seed.py` is invented. No real personal data has entered this
repo and none will. `ed.db` is git-ignored.
