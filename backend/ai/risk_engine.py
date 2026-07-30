"""
NICU clinical risk stratification — Low / Moderate / High.

Uses only fields actually collected (demographics, Apgar, vitals, support, complications).
Does not invent presentation text (cry/tone/etc.).
"""

from __future__ import annotations

from typing import Optional

RISK_FLAGS = {
    "prematurity": "Prematurity",
    "very_low_birth_weight": "Very low birth weight",
    "maternal_infection": "Maternal infection",
    "prolonged_rupture": "Prolonged rupture of membranes",
    "birth_asphyxia": "Birth asphyxia",
    "congenital_anomalies": "Congenital anomalies",
    "sepsis_suspicion": "Neonatal sepsis suspicion",
    "respiratory_distress_syndrome": "Respiratory distress syndrome",
}

TIER_PROBABILITY = {"Low": 2.5, "Moderate": 10.0, "High": 22.0}

# Model probability (%) → tier (single source of truth for ML + UI)
# Low ≤15, Moderate ≤30, High >30
HIGH_PROBABILITY_THRESHOLD = 30.0
MODERATE_PROBABILITY_THRESHOLD = 15.0

INTERVENTION_WINDOWS = {
    "High": "Immediate NICU escalation",
    "Moderate": "Enhanced monitoring within 6 hours",
    "Low": "Routine newborn care",
}

TIER_RANK = {"Low": 0, "Moderate": 1, "High": 2}


def tier_from_probability(prob_pct: float) -> str:
    """Map model probability (%) to Low / Moderate / High.

    Bands: ≤15 Low, ≤30 Moderate, >30 High.
    """
    if prob_pct > HIGH_PROBABILITY_THRESHOLD:
        return "High"
    if prob_pct > MODERATE_PROBABILITY_THRESHOLD:
        return "Moderate"
    return "Low"


def _escalate(current: str, candidate: str) -> str:
    return candidate if TIER_RANK[candidate] > TIER_RANK[current] else current


def _demographic_base_tier(ga: int, bw: float, mother_age: int) -> tuple[str, list[str]]:
    from ai.fallback import format_clinical_number

    factors: list[str] = []
    bw_txt = format_clinical_number(bw)

    if ga < 32 or bw < 1.5:
        if ga < 32:
            factors.append(f"Gestational age <32 weeks ({ga}w)")
        if bw < 1.5:
            factors.append(f"Birth weight <1.5 kg ({bw_txt} kg)")
        return "High", factors

    if (32 <= ga <= 36) or (1.5 <= bw < 2.5):
        if 32 <= ga <= 36:
            factors.append(f"Gestational age 32–36 weeks ({ga}w)")
        if 1.5 <= bw < 2.5:
            factors.append(f"Birth weight 1.5–2.49 kg ({bw_txt} kg)")
        return "Moderate", factors

    if ga >= 37 and bw >= 2.5:
        factors.append(f"Term infant ({ga}w, {bw_txt} kg)")
        if not (20 <= mother_age <= 35):
            factors.append(f"Maternal age outside 20–35 years ({mother_age})")
            return "Moderate", factors
        return "Low", factors

    factors.append("Demographics outside standard low-risk ranges")
    return "Moderate", factors


def _clinical_escalation(data: dict) -> tuple[str, list[str]]:
    tier = "Low"
    factors: list[str] = []

    resp = data.get("respiratory_support", "none")
    if resp == "ventilation":
        tier = _escalate(tier, "High")
        factors.append("Mechanical ventilation")
    elif resp in ("cpap", "oxygen"):
        tier = _escalate(tier, "Moderate")
        factors.append(f"Respiratory support: {resp}")

    if data.get("feeding_difficulty"):
        tier = _escalate(tier, "Moderate")
        factors.append("Feeding difficulty recorded")

    if data.get("sepsis") or data.get("sepsis_suspicion"):
        tier = _escalate(tier, "High")
        factors.append("Sepsis / sepsis suspicion")

    if data.get("respiratory_distress_syndrome"):
        tier = _escalate(tier, "High")
        factors.append("Respiratory distress syndrome (RDS)")

    if data.get("birth_asphyxia"):
        tier = _escalate(tier, "High")
        factors.append("Birth asphyxia")

    apgar1 = data.get("apgar_1min")
    if apgar1 is not None and apgar1 < 7:
        tier = _escalate(tier, "High" if apgar1 < 4 else "Moderate")
        factors.append(f"Apgar 1 min {apgar1}")

    apgar5 = data.get("apgar_5min")
    if apgar5 is not None and apgar5 < 7:
        tier = _escalate(tier, "High" if apgar5 < 4 else "Moderate")
        factors.append(f"Apgar 5 min {apgar5} — includes color, tone, cry/reflex, heart rate, respiratory effort")

    return tier, factors


def _vitals_escalation(data: dict) -> tuple[str, list[str]]:
    from ai.fallback import format_clinical_number

    tier = "Low"
    factors: list[str] = []

    temp = data.get("temperature")
    if temp is not None and not (36.5 <= temp <= 37.5):
        tier = _escalate(tier, "Moderate")
        factors.append(
            f"Temperature outside 36.5–37.5°C ({format_clinical_number(temp)}°C)"
        )

    hr = data.get("heart_rate")
    if hr is not None and not (100 <= hr <= 160):
        tier = _escalate(tier, "Moderate")
        factors.append(
            f"Heart rate outside 100–160 bpm ({format_clinical_number(hr)} bpm)"
        )

    rr = data.get("respiratory_rate")
    if rr is not None and not (30 <= rr <= 60):
        tier = _escalate(tier, "Moderate")
        factors.append(
            f"Respiratory rate outside 30–60/min ({format_clinical_number(rr)}/min)"
        )

    spo2 = data.get("spo2")
    if spo2 is not None and not (95 <= spo2 <= 100):
        tier = _escalate(tier, "Moderate")
        factors.append(f"SpO₂ outside 95–100% ({format_clinical_number(spo2)}%)")

    glucose = data.get("blood_glucose")
    if glucose is not None and not (45 <= glucose <= 125):
        tier = _escalate(tier, "Moderate")
        factors.append(
            f"Blood glucose outside 45–125 mg/dL ({format_clinical_number(glucose)} mg/dL)"
        )

    return tier, factors


def _flags_escalation(data: dict) -> tuple[str, list[str]]:
    tier = "Low"
    factors: list[str] = []
    flags = data.get("risk_flags") or []

    high_flags = {
        "birth_asphyxia",
        "congenital_anomalies",
        "sepsis_suspicion",
        "very_low_birth_weight",
        "respiratory_distress_syndrome",
    }
    mod_flags = {"prematurity", "maternal_infection", "prolonged_rupture"}

    for flag in flags:
        label = RISK_FLAGS.get(flag, flag)
        if flag in high_flags:
            tier = _escalate(tier, "High")
            factors.append(label)
        elif flag in mod_flags:
            tier = _escalate(tier, "Moderate")
            factors.append(label)
        else:
            factors.append(label)

    return tier, factors


def _completeness_confidence(data: dict) -> float:
    score = 0.45
    for key in (
        "apgar_5min",
        "apgar_1min",
        "spo2",
        "heart_rate",
        "temperature",
        "respiratory_rate",
        "blood_glucose",
    ):
        if data.get(key) is not None:
            score += 0.07
    if data.get("respiratory_support") and data.get("respiratory_support") != "none":
        score += 0.04
    if data.get("sepsis") is not None or data.get("respiratory_distress_syndrome") is not None:
        score += 0.05
    return min(round(score, 2), 0.96)


def calculate_risk(data: dict) -> dict:
    ga = int(data["gestational_age"])
    bw = float(data["birth_weight"])
    mother_age = int(data["mother_age"])

    tier, demo_factors = _demographic_base_tier(ga, bw, mother_age)
    all_factors = list(demo_factors)

    for escalation, extra in (
        _clinical_escalation(data),
        _vitals_escalation(data),
        _flags_escalation(data),
    ):
        tier = _escalate(tier, escalation)
        all_factors.extend(extra)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for f in all_factors:
        if f not in seen:
            seen.add(f)
            unique.append(f)

    if not unique:
        unique.append("Recorded clinical values within expected ranges")

    score_map = {"Low": 25, "Moderate": 55, "High": 85}
    return {
        "risk_score": score_map[tier],
        "risk_level": tier,
        "risk_factors": unique,
    }


# --- Clinical awareness: baseline (28-day) vs today's acuity ---------------

ACUITY_SCORE = {"Low": 18, "Moderate": 52, "High": 88}

# Birth / admission drivers that should not move with bedside reassess
_FIXED_FACTOR_HINTS = (
    "gestational age",
    "birth weight",
    "term infant",
    "maternal age",
    "apgar 1",
    "apgar 5",
    "prematurity",
    "very low birth weight",
    "multiple birth",
)

_MODIFIABLE_FACTOR_HINTS = (
    "respiratory support",
    "mechanical ventilation",
    "feeding",
    "sepsis",
    "respiratory distress",
    "birth asphyxia",
    "temperature",
    "heart rate",
    "respiratory rate",
    "spo₂",
    "spo2",
    "blood glucose",
    "oxygenation",
)


def _dedupe(factors: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for f in factors:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


def classify_factor(factor: str) -> str:
    """Return fixed | modifiable | neutral for awareness UI chips."""
    lower = factor.lower()
    if (
        "within expected ranges" in lower
        or "no major risk" in lower
        or "term infant" in lower
    ):
        # Term infant is fixed demographically but neutral for alarm styling
        if "term infant" in lower:
            return "fixed"
        return "neutral"
    if any(h in lower for h in _FIXED_FACTOR_HINTS):
        return "fixed"
    if any(h in lower for h in _MODIFIABLE_FACTOR_HINTS):
        return "modifiable"
    return "modifiable"


def _today_clinical_escalation(data: dict) -> tuple[str, list[str]]:
    """Modifiable bedside state only — excludes Apgar (birth-locked)."""
    tier = "Low"
    factors: list[str] = []

    resp = data.get("respiratory_support", "none")
    if resp == "ventilation":
        tier = _escalate(tier, "High")
        factors.append("Mechanical ventilation")
    elif resp in ("cpap", "oxygen"):
        tier = _escalate(tier, "Moderate")
        factors.append(f"Respiratory support: {resp}")

    if data.get("feeding_difficulty"):
        tier = _escalate(tier, "Moderate")
        factors.append("Feeding difficulty recorded")

    if data.get("sepsis") or data.get("sepsis_suspicion"):
        tier = _escalate(tier, "High")
        factors.append("Sepsis / sepsis suspicion")

    if data.get("respiratory_distress_syndrome"):
        tier = _escalate(tier, "High")
        factors.append("Respiratory distress syndrome (RDS)")

    if data.get("birth_asphyxia"):
        tier = _escalate(tier, "High")
        factors.append("Birth asphyxia")

    return tier, factors


def compute_clinical_acuity(data: dict) -> dict:
    """
    Today's clinical acuity from vitals + support + complications.
    Intentionally ignores GA / birth weight / Apgar so reassess can show progress.
    """
    clinical = assessment_data_from_dict(data) if "gestational_age" in data else data
    tier = "Low"
    factors: list[str] = []

    for escalation, extra in (
        _today_clinical_escalation(clinical),
        _vitals_escalation(clinical),
    ):
        tier = _escalate(tier, escalation)
        factors.extend(extra)

    factors = _dedupe(factors)
    if not factors:
        factors = ["Bedside vitals and support within expected ranges"]

    return {
        "tier": tier,
        "score": ACUITY_SCORE[tier],
        "factors": factors,
        "label": "Today's clinical acuity",
    }


def split_risk_factors(factors: list[str]) -> dict:
    fixed: list[str] = []
    modifiable: list[str] = []
    neutral: list[str] = []
    for f in factors or []:
        bucket = classify_factor(f)
        if bucket == "fixed":
            fixed.append(f)
        elif bucket == "neutral":
            neutral.append(f)
        else:
            modifiable.append(f)
    return {"fixed": fixed, "modifiable": modifiable, "neutral": neutral}


def _trajectory_direction(acuity_delta: float, probability_delta: float) -> str:
    # Prefer 28-day risk change for condition messaging; fall back to acuity.
    if probability_delta <= -1.5:
        return "improving"
    if probability_delta >= 1.5:
        return "worsening"
    if acuity_delta <= -8:
        return "improving"
    if acuity_delta >= 8:
        return "worsening"
    return "stable"


def _factor_set(factors: list[str] | None) -> set[str]:
    return {str(f).strip() for f in (factors or []) if str(f).strip()}


def _trajectory_message(
    direction: str,
    *,
    is_reassess: bool,
    acuity_tier: str,
    estimate_tier: str,
    probability_delta: float,
    acuity_delta: float,
    previous_probability: float | None = None,
    current_probability: float | None = None,
    improved_factors: list[str] | None = None,
    worsened_factors: list[str] | None = None,
) -> str:
    from ai.fallback import format_risk_pct, round_risk_pct

    if not is_reassess:
        return (
            "Admission sets the 28-day baseline from birth profile. "
            "Reassess later to track today's bedside state — vitals, weight change, and complications."
        )

    prev = previous_probability
    curr = current_probability
    delta = round_risk_pct(probability_delta)
    improved = [f for f in (improved_factors or []) if f][:3]
    worsened = [f for f in (worsened_factors or []) if f][:3]

    range_note = (
        f" ({format_risk_pct(prev)}% → {format_risk_pct(curr)}%)"
        if prev is not None and curr is not None
        else ""
    )

    if direction == "improving":
        parts = [
            f"Baby's condition improved: 28-day risk fell {format_risk_pct(abs(delta))}%{range_note}."
        ]
        if improved:
            parts.append("Improved drivers: " + "; ".join(improved) + ".")
        elif worsened:
            parts.append("Still watch: " + "; ".join(worsened) + ".")
        else:
            parts.append("Bedside signals look more stable than the last assessment.")
        return " ".join(parts)

    if direction == "worsening":
        parts = [
            f"Baby's condition worsened: 28-day risk rose {format_risk_pct(abs(delta))}%{range_note}."
        ]
        if worsened:
            parts.append("What worsened: " + "; ".join(worsened) + ".")
        else:
            parts.append("Review current weight trajectory, vitals, sepsis, and respiratory status.")
        return " ".join(parts)

    delta_note = ""
    if abs(delta) >= 0.3:
        sign = "+" if delta >= 0 else "−"
        delta_note = f" 28-day estimate changed {sign}{format_risk_pct(abs(delta))}%."
    return (
        f"Condition is broadly stable at {estimate_tier} risk (acuity {acuity_tier}).{delta_note}"
    )


def build_clinical_awareness(
    *,
    clinical_data: dict,
    mortality_probability: float,
    mortality_tier: str,
    mortality_factors: list[str],
    baseline_probability: float | None = None,
    baseline_tier: str | None = None,
    previous_probability: float | None = None,
    previous_acuity_score: float | None = None,
    previous_factors: list[str] | None = None,
    is_reassess: bool = False,
) -> dict:
    """Dual-score awareness payload for admit + reassess UIs."""
    from ai.fallback import round_risk_pct

    acuity = compute_clinical_acuity(clinical_data)
    groups = split_risk_factors(mortality_factors)

    mortality_probability = round_risk_pct(mortality_probability)
    base_prob = round_risk_pct(
        baseline_probability if baseline_probability is not None else mortality_probability
    )
    base_tier = normalize_tier(baseline_tier or mortality_tier)

    prev_prob = round_risk_pct(
        previous_probability if previous_probability is not None else mortality_probability
    )
    probability_delta = round_risk_pct(mortality_probability - prev_prob)
    vs_baseline_delta = round_risk_pct(mortality_probability - base_prob)

    prev_acuity = previous_acuity_score if previous_acuity_score is not None else acuity["score"]
    acuity_delta = round(float(acuity["score"]) - float(prev_acuity), 1)

    current_set = _factor_set(mortality_factors)
    previous_set = _factor_set(previous_factors)
    improved_factors = sorted(previous_set - current_set)
    worsened_factors = sorted(current_set - previous_set)

    direction = (
        "baseline"
        if not is_reassess
        else _trajectory_direction(acuity_delta, probability_delta)
    )

    return {
        "baseline": {
            "probability": base_prob,
            "tier": base_tier,
            "label": "Admission baseline (28-day)",
        },
        "current_estimate": {
            "probability": mortality_probability,
            "tier": normalize_tier(mortality_tier),
            "label": "Current 28-day estimate",
        },
        "acuity": {
            **acuity,
            "tier": normalize_tier(acuity["tier"]),
        },
        "trajectory": {
            "direction": direction,
            "probability_delta": probability_delta if is_reassess else 0.0,
            "acuity_delta": acuity_delta if is_reassess else 0.0,
            "vs_baseline_delta": vs_baseline_delta,
            "improved_factors": improved_factors if is_reassess else [],
            "worsened_factors": worsened_factors if is_reassess else [],
            "message": _trajectory_message(
                direction if is_reassess else "baseline",
                is_reassess=is_reassess,
                acuity_tier=normalize_tier(acuity["tier"]),
                estimate_tier=normalize_tier(mortality_tier),
                probability_delta=probability_delta if is_reassess else 0.0,
                acuity_delta=acuity_delta if is_reassess else 0.0,
                previous_probability=float(prev_prob) if is_reassess else None,
                current_probability=float(mortality_probability) if is_reassess else None,
                improved_factors=improved_factors if is_reassess else None,
                worsened_factors=worsened_factors if is_reassess else None,
            ),
        },
        "factors": groups,
        "awareness_note": (
            "Admission baseline uses birth profile. Re-assessment updates current 28-day risk from "
            "bedside state (current weight, weight change, vitals, sepsis, RDS, asphyxia)."
        ),
    }


def predict_mortality(data: dict, risk_score: Optional[float] = None) -> dict:
    """Rules-based mortality tier from clinical inputs."""
    risk = calculate_risk(data)
    tier = risk["risk_level"]
    probability = TIER_PROBABILITY[tier]

    return {
        "mortality_probability": probability,
        "mortality_tier": tier,
        "mortality_factors": risk["risk_factors"],
        "model_confidence": _completeness_confidence(data),
        "intervention_window": INTERVENTION_WINDOWS[tier],
        "model_source": "clinical-rules-v2",
    }


def normalize_tier(tier: str) -> str:
    if tier in TIER_PROBABILITY:
        return tier
    legacy = {"Critical": "High", "Minimal": "Low", "Medium": "Moderate"}
    return legacy.get(tier, "Low")


def assessment_data_from_dict(data: dict) -> dict:
    return {
        "gestational_age": data["gestational_age"],
        "birth_weight": data["birth_weight"],
        "current_weight": data.get("current_weight", data.get("birth_weight")),
        "mother_age": data["mother_age"],
        "gender": data.get("gender", ""),
        "apgar_1min": data.get("apgar_1min"),
        "apgar_5min": data.get("apgar_5min"),
        "apgar_1min_components": data.get("apgar_1min_components"),
        "apgar_5min_components": data.get("apgar_5min_components"),
        "respiratory_support": data.get("respiratory_support") or "none",
        "feeding_difficulty": bool(data.get("feeding_difficulty", False)),
        "clinical_status": data.get("clinical_status") or "healthy",
        "risk_flags": data.get("risk_flags") or [],
        "temperature": data.get("temperature"),
        "heart_rate": data.get("heart_rate"),
        "respiratory_rate": data.get("respiratory_rate"),
        "spo2": data.get("spo2"),
        "blood_glucose": data.get("blood_glucose"),
        "sepsis": bool(data.get("sepsis", False)),
        "respiratory_distress_syndrome": bool(data.get("respiratory_distress_syndrome", False)),
        "birth_asphyxia": bool(data.get("birth_asphyxia", False)),
        "respiratory_distress_grade": data.get("respiratory_distress_grade"),
        "birth_asphyxia_grade": data.get("birth_asphyxia_grade"),
        "prolonged_rupture_of_membranes": bool(data.get("prolonged_rupture_of_membranes", False)),
        "multiple_birth": bool(data.get("multiple_birth", False)),
        "antenatal_visits": data.get("antenatal_visits"),
        "maternal_hypertension": bool(data.get("maternal_hypertension", False)),
        "maternal_diabetes": bool(data.get("maternal_diabetes", False)),
        "delivery_type": data.get("delivery_type"),
        "delivery_vaginal": data.get("delivery_vaginal"),
    }


def assessment_data_from_model(assessment) -> dict:
    patient = getattr(assessment, "patient", None)
    maternal = getattr(patient, "maternal", None) if patient else None
    delivery = getattr(patient, "delivery_type", "") if patient else ""
    return assessment_data_from_dict({
        "gestational_age": assessment.gestational_age,
        "birth_weight": assessment.birth_weight,
        "current_weight": getattr(assessment, "current_weight", None) or assessment.birth_weight,
        "mother_age": assessment.mother_age,
        "gender": assessment.gender,
        "apgar_1min": assessment.apgar_1min,
        "apgar_5min": assessment.apgar_5min,
        "apgar_1min_components": getattr(assessment, "apgar_1min_components", None),
        "apgar_5min_components": getattr(assessment, "apgar_5min_components", None),
        "respiratory_support": assessment.respiratory_support,
        "feeding_difficulty": assessment.feeding_difficulty,
        "clinical_status": getattr(assessment, "clinical_status", "healthy") or "healthy",
        "risk_flags": getattr(assessment, "risk_flags", None) or [],
        "temperature": assessment.temperature,
        "heart_rate": assessment.heart_rate,
        "respiratory_rate": getattr(assessment, "respiratory_rate", None),
        "spo2": assessment.spo2,
        "blood_glucose": getattr(assessment, "blood_glucose", None),
        "sepsis": getattr(assessment, "sepsis", False),
        "respiratory_distress_syndrome": getattr(assessment, "respiratory_distress_syndrome", False),
        "birth_asphyxia": getattr(assessment, "birth_asphyxia", False),
        "respiratory_distress_grade": (
            getattr(assessment, "respiratory_distress_grade", None)
            or (
                "Moderate"
                if getattr(assessment, "respiratory_distress_syndrome", False)
                else "None"
            )
        ),
        "birth_asphyxia_grade": (
            getattr(assessment, "birth_asphyxia_grade", None)
            or (
                "Moderate"
                if getattr(assessment, "birth_asphyxia", False)
                else "None"
            )
        ),
        "multiple_birth": getattr(assessment, "multiple_birth", False),
        "antenatal_visits": getattr(maternal, "anc_visits", None) if maternal else None,
        "maternal_hypertension": getattr(maternal, "hypertension", False) if maternal else False,
        "maternal_diabetes": getattr(maternal, "gestational_diabetes", False) if maternal else False,
        "delivery_type": delivery,
        "delivery_vaginal": 1 if delivery in ("", "normal_vaginal", "assisted_forceps") else 0,
    })


def aligned_risk_payload(data: dict) -> dict:
    """Prefer trained Random Forest; fall back to clinical rules."""
    clinical = assessment_data_from_dict(data)
    try:
        from ai.ml_predictor import predict_risk

        ml = predict_risk(clinical)
        if ml is not None:
            return ml
    except Exception:
        pass

    result = predict_mortality(clinical)
    tier = normalize_tier(result["mortality_tier"])
    return {
        **result,
        "mortality_tier": tier,
        "mortality_probability": TIER_PROBABILITY[tier],
        "intervention_window": INTERVENTION_WINDOWS[tier],
        "model_source": result.get("model_source", "clinical-rules-v2"),
    }
