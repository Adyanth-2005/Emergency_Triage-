# Demo Script — ED Triage Console (≈3 minutes)

**Setup:** `python seed.py && python app.py` → open http://127.0.0.1:5000

The seed is deterministic (RNG 20260711): 6 patients, 2 MLC cases (1 with a **pending**
intimation — the US-6 hook), 1 disposition, door-to-doctor stamps, and 19 hash-chained
audit rows on first login.

---

### 1. Dashboard (20s)
Point at the six KPI tiles — all computed from data. Read the **Operational insight** card:
_"N of M active patients past NABH target… 1 MLC case has no intimation logged."_ Note the
green **Chain intact** pill in the top bar and the amber **Demo** environment badge.

### 2. Treat-first registration → triage (50s)
- **Quick registration → “Register instantly.”** A temp ID is issued with **zero** mandatory fields (Art. 21). You land on the triage form.
- Type a chief complaint, tick a red flag (e.g. _Poisoning ingestion_) and enter `SpO₂ 88`.
- Watch the **Suggested level** card update live to **L2 Emergent** with reasons and **High evidence**. This is advisory — the five-block **3D level picker** is the confirmation act.
- Pick a **different** level → the **override reason** field appears and is required (≥10 chars). Pick the suggested level and **Save triage**. A toast confirms; the encounter hub shows the **explainability card** (_suggested Lx · confirmed Lx · accepted_).

### 3. Tracking board (25s)
Open **Tracking board**: untriaged pinned on top, **acuity colour spines**, live wait, and
**breach rows pulsing** past their NABH target. Click **Attend** on a triaged patient →
**door-to-doctor** is stamped server-side; the dashboard KPI moves.

### 4. Medico-legal + the US-6 showpiece (45s)
- Open the **unknown RTA** encounter (seeded MLC, **no** intimation).
- Try **Disposition → Discharge.** The **US-6 warning** fires: _"MLC encounter with no police intimation logged"_ citing **BNSS 2023 §194-196** — but it **does not block** (Art. 21). Tick acknowledge + type a justification to proceed, **or** cancel.
- Instead, **Log intimation** (officer name + badge + method are mandatory — that is the statutory evidence), then dispose cleanly.

### 5. Governance (20s)
- **MLC register** → gapless serials, POCSO notice where applicable.
- **Audit trail** → **"Hash chain verified · N rows"**; every step you just did is a colour-coded, chained row. Filter by action.
- **Override report** → the single seeded downgrade/upgrade, ready for the monthly medical-director review (PRD-05 §11).

### 6. Extras (10s)
`Ctrl/⌘-K` command palette · role switcher (watch actions gate by role) · **Reset demo data**
to return to the exact seeded state.

---

**One-liner:** _the engine suggests, the human decides, and the tamper-evident chain
remembers — and care is never delayed to protect the software's compliance record._
