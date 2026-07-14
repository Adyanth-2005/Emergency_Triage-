# Compliance Notes (P5)

All patient data is **synthetic** (DPDP discipline). No real personal data appears anywhere
in the repo. No external government/health APIs are called; any such integration would be
**mock/stub only**.

| Obligation | Where enforced |
|---|---|
| **Art. 21 / Parmanand Katara (SC 1989)** — treat first, never delay care | Quick-reg accepts an empty body (temp ID issued); US-6 warns but **never blocks** disposition |
| **BNSS 2023 §194-196** — police intimation for MLC | MLC serial + `police_intimation` log; disposition 409-warns until logged or justified |
| **POCSO §19-21** — mandatory reporting, non-reporting punishable | `pocso_flag` set at open time, non-clearable; embedded notice in UI |
| **NABH time-norms** — acuity wait targets | `triage_scale_config.max_wait_minutes`; breach flag on board + KPI |
| **MCCD Form 4/4A (RBD Act 1969)** — cause of death | Death dispositions require `death_ts` + `cause_of_death_icd10` (schema CHECK) |
| **Audit defensibility (PRD-05 §7)** — tamper-evident, NTP-defensible timestamps | Server-side UTC timestamps; SHA-256 hash chain; append-only triggers |
| **Override governance (PRD-05 §11)** | Both suggested and final level persisted; override reason mandatory; monthly report view |
| **DPDP** — synthetic data only | `seed.py` invented names; no PII collected |

**Design stance (D-5 / US-6):** the software must never hold a patient in the ED to protect
its own compliance record. It **warns with the statute cited** and puts any silence on the
record with a named operator — the patient always leaves.
