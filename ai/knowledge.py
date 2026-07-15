"""
Policy / compliance knowledge corpus for the ED console.

These are the AUTHORITATIVE sources the copilot is allowed to ground on and
cite. They summarise the statutory and operational rules the product itself
implements. All synthetic / educational — no patient data. The repo's own
docs/*.md are ingested alongside these at index-build time.
"""

SOURCES = [
    {
        "doc_id": "art21-katara", "title": "Treat-first duty (Article 21)",
        "section": "Constitutional / Parmanand Katara v. Union of India (SC 1989)",
        "category": "Statutory",
        "text": (
            "Article 21 of the Constitution guarantees the right to life, which the "
            "Supreme Court in Parmanand Katara v. Union of India (1989) held includes "
            "the right to emergency medical care. A hospital or doctor cannot refuse or "
            "delay life-saving treatment to await police formalities, payment, or "
            "completion of paperwork. In this system that principle is enforced by "
            "treat-first registration: an encounter can be created with zero mandatory "
            "fields, issuing a temporary ID, so care is never blocked by data entry."
        ),
    },
    {
        "doc_id": "bnss-194", "title": "Police intimation for medico-legal cases",
        "section": "BNSS 2023 §194-196",
        "category": "Statutory",
        "text": (
            "The Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) sections 194 to 196 "
            "govern police intimation and inquest for medico-legal cases (MLC) such as "
            "road-traffic accidents, assault, poisoning, burns, firearm injury, suicide "
            "attempt, and unnatural or suspicious death. The hospital must inform the "
            "police without delay. In this console every MLC receives a gapless "
            "statutory serial (MLC/YYYY/nnnn) and a police-intimation log recording the "
            "officer name, badge number, station, method and timestamp — that log is the "
            "evidence the duty was met. Disposing of an MLC encounter with no intimation "
            "logged raises a hard warning citing BNSS §194-196, but never blocks care "
            "(Article 21): the clinician may proceed with a recorded justification."
        ),
    },
    {
        "doc_id": "pocso", "title": "POCSO mandatory reporting",
        "section": "POCSO Act 2012 §19-21",
        "category": "Statutory",
        "text": (
            "Under the Protection of Children from Sexual Offences (POCSO) Act, sections "
            "19 to 21, any person (including a doctor or hospital) who has knowledge or "
            "apprehension of a sexual offence against a child must report it to the "
            "Special Juvenile Police Unit or local police. Non-reporting is itself a "
            "punishable offence. When an MLC of type SEXUAL_OFFENCE_POCSO is opened the "
            "system sets a non-dismissible POCSO flag and surfaces the mandatory-reporting "
            "notice."
        ),
    },
    {
        "doc_id": "triage-scale", "title": "Five-level acuity scale (AIIMS Triage Protocol)",
        "section": "PRD-05 FR-1 / NABH time norms",
        "category": "Clinical",
        "text": (
            "Triage uses a five-level acuity scale. Level 1 Resuscitation: immediate, "
            "life-threatening (cardiac/respiratory arrest, unresponsive, active seizure). "
            "Level 2 Emergent: target under 10 minutes (ischaemic chest pain, FAST-positive "
            "stroke, major trauma, poisoning). Level 3 Urgent: about 30 minutes. Level 4 "
            "Less-urgent: about 60 minutes. Level 5 Non-urgent: about 120 minutes. A "
            "patient past their level's target wait is a NABH time-norm breach and is "
            "flagged on the tracking board. The engine SUGGESTS a level from red flags and "
            "vitals; a nurse confirms it. Ties resolve to the more acute level, and an "
            "unmatched complaint safe-defaults to Level 4 — under-triage is the failure "
            "mode that kills, so ignorance errs toward acuity."
        ),
    },
    {
        "doc_id": "advisory", "title": "Advisory-only AI guarantee",
        "section": "PRD-05 §10 / AI_ADVISORY",
        "category": "Governance",
        "text": (
            "All AI and rules-engine output in this product is advisory only. The engine "
            "suggests an acuity level with reasons; a human confirms it; and the "
            "confirmation is written to the tamper-evident audit chain. The suggestion is "
            "recomputed server-side on submit, so the guarantee cannot depend on client "
            "code. The LLM copilot explains and summarises grounded in this corpus and the "
            "live data — it never assigns a clinical level, never opens an MLC, and never "
            "writes a record. Every recommendation carries an evidence-confidence label "
            "(High / Medium / Low) and its sources, and the human owns every decision."
        ),
    },
    {
        "doc_id": "override", "title": "Triage override governance",
        "section": "PRD-05 §11",
        "category": "Governance",
        "text": (
            "When a nurse confirms a final level that differs from the engine's suggestion "
            "it is an override, and a reason of at least ten characters is mandatory — "
            "enforced by a database CHECK, not merely the UI. Both the suggested and the "
            "confirmed level are stored, so overrides are queryable. They are reported to "
            "the medical director monthly. Downgrades (final less acute than suggested) are "
            "the direction that warrants scrutiny; upgrades are generally protective."
        ),
    },
    {
        "doc_id": "audit", "title": "Tamper-evident audit chain",
        "section": "PRD-05 §7",
        "category": "Governance",
        "text": (
            "Every action — registration, triage, physician attend, MLC open, police "
            "intimation, disposition, login, logout — writes an append-only audit row. "
            "Each row's hash is SHA-256(previous_hash + canonical_payload), forming a "
            "chain. Editing any historical row breaks every hash after it, so tampering is "
            "detectable. Triggers forbid UPDATE and DELETE on the audit log. The audit view "
            "shows a live 'chain verified' or 'chain broken at row N' verdict."
        ),
    },
    {
        "doc_id": "disposition", "title": "Disposition types and the US-6 warning",
        "section": "PRD-05 FR-8 / US-6",
        "category": "Clinical",
        "text": (
            "An encounter ends in exactly one disposition: ADMIT, REFER_OUT, DISCHARGE, "
            "LAMA (left against medical advice), DEATH, or BROUGHT_DEAD. Each type carries "
            "its own mandatory fields, enforced by database CHECK constraints (for example "
            "a death disposition requires a time of death and an ICD-10 cause; a referral "
            "requires facility and reason). The US-6 rule: disposing of an MLC encounter "
            "with no police intimation logged warns hard (HTTP 409) citing BNSS §194-196 "
            "but does not block — the patient always leaves; the silence is recorded with a "
            "named justification."
        ),
    },
    {
        "doc_id": "door-to-doctor", "title": "Door-to-doctor and the tracking board",
        "section": "FR-3",
        "category": "Operations",
        "text": (
            "Door-to-doctor is the interval from arrival to first physician contact, "
            "stamped server-side when a physician attends; it is a core NABH quality metric "
            "shown as a median on the dashboard. The tracking board lists active encounters "
            "sorted untriaged-first, then by acuity, then by longest wait, with a coloured "
            "spine per level and a pulsing indicator for breaches. Unknown patients appear "
            "on a temporary ID until reconciled."
        ),
    },
    {
        "doc_id": "good-samaritan", "title": "Good Samaritan protection",
        "section": "MoRTH Good Samaritan Guidelines 2016",
        "category": "Statutory",
        "text": (
            "A bystander who brings an injured person to hospital (a Good Samaritan) may "
            "not be detained, must not be compelled to reveal personal details, and cannot "
            "be held liable for the outcome. Accordingly the 'brought by' field is optional "
            "and arrival mode GOOD_SAMARITAN records that bystander details were declined."
        ),
    },
    {
        "doc_id": "mccd", "title": "Death certification (MCCD Form 4 / 4A)",
        "section": "RBD Act 1969",
        "category": "Statutory",
        "text": (
            "Deaths are certified on the Medical Certificate of Cause of Death, Form 4 for "
            "institutional deaths and Form 4A for non-institutional, under the Registration "
            "of Births and Deaths Act 1969. The cause is coded to ICD-10. An unnatural or "
            "suspicious death is a medico-legal case and requires police intimation before "
            "the body is released, per BNSS."
        ),
    },
    {
        "doc_id": "rbac", "title": "Roles and permissions",
        "section": "PRD-05 §3",
        "category": "Governance",
        "text": (
            "Roles: a triage nurse registers and triages; a physician can additionally "
            "attend, dispose, open MLCs and log intimations; a CMO handles medico-legal "
            "registration and intimation; a receptionist registers and views the board "
            "only; an administrator has full access including demo reset. Permissions are "
            "enforced server-side on every write, not merely by hiding buttons, and the "
            "acting user is derived from a signed session — the request body cannot forge "
            "the audit actor."
        ),
    },
]
