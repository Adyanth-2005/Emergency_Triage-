"""
P5 — AIIMS Triage Protocol rules engine (FR-1).

The scale is CONFIGURABLE (PRD-05 FR-1): thresholds live in
triage_scale_config.criteria_json, not in this file. This module only
knows how to *evaluate* a criteria set against a vitals set. Swapping
AIIMS TP for adapted ESI means new config rows, not new code.

Design constraints that matter:

  * Missing vitals must DEGRADE GRACEFULLY. A combative trauma patient
    does not hold still for a full vitals set. A rule engine that
    demands every field is a rule engine the nurse abandons.

  * The engine SUGGESTS. It never assigns. PRD-05 §10 AI-1 guardrail:
    "never assigns final level; nurse confirms". Even though this is a
    deterministic rule engine rather than a model, the same discipline
    applies — the human owns the number.

  * Ties resolve to the MORE acute level. Under-triage kills; over-triage
    costs a bay.
"""

import json

# The default AIIMS TP criteria, seeded into triage_scale_config.
# Kept here as the seed source, evaluated generically below.
AIIMS_TP = [
    {
        "level": 1,
        "label": "Resuscitation",
        "colour": "RED",
        "max_wait_minutes": 0,          # immediate — PRD-05 §2
        "criteria": {
            "red_flags": [
                "cardiac_arrest", "respiratory_arrest", "apnoea",
                "active_severe_haemorrhage", "unresponsive",
                "airway_compromise", "seizure_ongoing",
            ],
            "vitals": {
                "gcs":  {"max": 8},
                "spo2": {"max": 89},
                "sbp":  {"max": 79},
                "hr":   {"max": 39, "or_min": 150},
                "rr":   {"max": 7,  "or_min": 35},
            },
        },
    },
    {
        "level": 2,
        "label": "Emergent",
        "colour": "ORANGE",
        "max_wait_minutes": 10,         # <10 min — PRD-05 §2
        "criteria": {
            "red_flags": [
                "chest_pain_ischaemic", "stroke_fast_positive",
                "major_trauma", "severe_breathlessness",
                "poisoning_ingestion", "suspected_sepsis",
                "pregnancy_bleeding", "acute_abdomen_severe",
            ],
            "vitals": {
                "gcs":  {"min": 9,  "max": 12},
                "spo2": {"min": 90, "max": 93},
                "sbp":  {"min": 80, "max": 89},
                "hr":   {"min": 130, "max": 149},
                "rr":   {"min": 31,  "max": 34},
                "temp_c": {"or_min": 40.0},
            },
        },
    },
    {
        "level": 3,
        "label": "Urgent",
        "colour": "YELLOW",
        "max_wait_minutes": 30,         # assumption A-1
        "criteria": {
            "red_flags": [
                "moderate_trauma", "persistent_vomiting",
                "fever_with_comorbidity", "moderate_pain",
                "dehydration", "asthma_moderate",
            ],
            "vitals": {
                "spo2": {"min": 94, "max": 95},
                "sbp":  {"min": 90, "max": 99},
                "hr":   {"min": 111, "max": 129},
                "rr":   {"min": 25,  "max": 30},
                "temp_c": {"or_min": 38.5},
            },
        },
    },
    {
        "level": 4,
        "label": "Semi-urgent",
        "colour": "GREEN",
        "max_wait_minutes": 60,         # assumption A-1
        "criteria": {
            "red_flags": [
                "minor_fracture", "simple_laceration", "mild_pain",
                "minor_burn", "animal_bite_minor",
            ],
            "vitals": {},
        },
    },
    {
        "level": 5,
        "label": "Non-urgent",
        "colour": "BLUE",
        "max_wait_minutes": 120,        # assumption A-1
        "criteria": {
            "red_flags": [
                "dressing_change", "prescription_refill",
                "medical_certificate", "suture_removal",
            ],
            "vitals": {},
        },
    },
]

VITAL_KEYS = ("hr", "rr", "sbp", "dbp", "spo2", "temp_c", "gcs")


def _vital_matches(value, rule):
    """
    Evaluate one vital against one threshold rule.

    Rule grammar:
        {"max": x}              value <= x
        {"min": x}              value >= x
        {"min": a, "max": b}    a <= value <= b   (a band)
        {"or_min": x}           value >= x        (an OR-arm, e.g. brady OR tachy)

    A missing value never matches and never raises. Graceful degradation
    is the whole point.
    """
    if value is None:
        return False

    lo, hi = rule.get("min"), rule.get("max")
    if lo is not None and hi is not None:
        if lo <= value <= hi:
            return True
    elif hi is not None:
        if value <= hi:
            return True
    elif lo is not None:
        if value >= lo:
            return True

    or_min = rule.get("or_min")
    if or_min is not None and value >= or_min:
        return True

    return False


def evaluate(vitals: dict, red_flags: list, scale: list = None) -> dict:
    """
    Suggest a triage level.

    Returns the suggestion plus the REASONS for it. The reasons are not
    decoration: a nurse who cannot see why the machine said "Level 2" has
    no basis to accept or override it, and an override with no visible
    baseline is not a clinical judgement — it is a coin toss.

    Scans most-acute-first and returns on the first hit, so ties resolve
    upward in acuity.
    """
    scale = scale or AIIMS_TP
    red_flags = set(red_flags or [])
    vitals = {k: vitals.get(k) for k in VITAL_KEYS}

    for band in sorted(scale, key=lambda b: b["level"]):
        criteria = band["criteria"]
        reasons = []

        hit_flags = red_flags & set(criteria.get("red_flags", []))
        reasons.extend(f"red flag: {f}" for f in sorted(hit_flags))

        for vital, rule in criteria.get("vitals", {}).items():
            if _vital_matches(vitals.get(vital), rule):
                reasons.append(f"{vital} = {vitals[vital]}")

        if reasons:
            return {
                "suggested_level": band["level"],
                "label": band["label"],
                "colour": band["colour"],
                "max_wait_minutes": band["max_wait_minutes"],
                "reasons": reasons,
                "vitals_missing": [k for k in VITAL_KEYS if vitals.get(k) is None],
            }

    # Nothing tripped. Default to 4 (semi-urgent), not 5.
    #
    # This asymmetry is deliberate and is the single most defensible line
    # in the file. A patient whose complaint matches no rule is a patient
    # the RULES do not understand — not a patient who is fine. Under-triage
    # is the failure mode that kills people; over-triage costs a bay for
    # twenty minutes. When the engine is ignorant, it must be ignorant in
    # the direction that is survivable.
    return {
        "suggested_level": 4,
        "label": "Semi-urgent",
        "colour": "GREEN",
        "max_wait_minutes": 60,
        "reasons": ["no rule matched — defaulting to semi-urgent (safe default)"],
        "vitals_missing": [k for k in VITAL_KEYS if vitals.get(k) is None],
    }


def seed_rows():
    """Rows for triage_scale_config. Called by seed.py."""
    return [
        (
            "AIIMS_TP",
            b["level"],
            b["label"],
            b["colour"],
            b["max_wait_minutes"],
            json.dumps(b["criteria"]),
            1,
        )
        for b in AIIMS_TP
    ]
