"""
FR-7 / AI-5 — mandatory-reporting matrix.

Deterministic, explainable: given an encounter's MLC type, triage red flags and
complaint, return the statutory reporting duties that apply, each with its
citation. POCSO is a HARD duty (cannot be dismissed without a recorded reason);
the rest are prompts. This is the rule engine behind the reporting card.
"""

# duty code -> (label, statute)
_DUTIES = {
    "POCSO":          ("POCSO — report child sexual offence to SJPU/police", "POCSO Act 2012 §19-21"),
    "FOUL_PLAY":      ("Suspected foul play — police intimation", "BNSS 2023 §194-196"),
    "FIREARM":        ("Firearm injury — police intimation", "BNSS §194-196 + Arms Act 1959"),
    "UNNATURAL_DEATH":("Unnatural/suspicious death — inquest procedure", "BNSS 2023 §194"),
    "BURNS_DOWRY":    ("Burns — dowry-death screening & burns register", "IPC 304B context; state burns register"),
    "IDSP_BITE":      ("Animal bite — IDSP notifiable (rabies surveillance)", "IDSP/IHIP notifiable conditions"),
    "POISONING":      ("Poisoning — MLC + IDSP cluster watch", "BNSS §194-196 + IDSP/IHIP"),
    "MV_ACT":         ("Road-accident victim — cashless/golden-hour entitlement", "MV (Amendment) Act 2019"),
}

_RED_FLAG_MAP = {
    "animal_bite_minor": "IDSP_BITE", "animal_bite": "IDSP_BITE",
    "poisoning_ingestion": "POISONING", "minor_burn": "BURNS_DOWRY", "burn": "BURNS_DOWRY",
}
_MLC_MAP = {
    "SEXUAL_OFFENCE_POCSO": "POCSO", "SUSPECTED_FOUL_PLAY": "FOUL_PLAY",
    "FIREARM": "FIREARM", "UNNATURAL_DEATH": "UNNATURAL_DEATH",
    "POISONING": "POISONING", "BURNS": "BURNS_DOWRY", "RTA": "MV_ACT",
}


def duties_for(mlc_type=None, red_flags=None, complaint=None, arrival_mode=None):
    """Return [{code, label, statute, severity, hard}] — deduplicated, ordered."""
    codes = []
    if mlc_type in _MLC_MAP:
        codes.append(_MLC_MAP[mlc_type])
    for f in (red_flags or []):
        if f in _RED_FLAG_MAP:
            codes.append(_RED_FLAG_MAP[f])
    text = (complaint or "").lower()
    if "burn" in text:
        codes.append("BURNS_DOWRY")
    if "bite" in text:
        codes.append("IDSP_BITE")
    if arrival_mode in ("AMBULANCE_108", "POLICE") and "accident" in text:
        codes.append("MV_ACT")

    out, seen = [], set()
    for c in codes:
        if c in seen or c not in _DUTIES:
            continue
        seen.add(c)
        label, statute = _DUTIES[c]
        out.append({"code": c, "label": label, "statute": statute,
                    "severity": "HIGH" if c == "POCSO" else "MEDIUM",
                    "hard": c == "POCSO"})
    return out
