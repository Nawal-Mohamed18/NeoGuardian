from ai.risk_engine import (
    INTERVENTION_WINDOWS,
    aligned_risk_payload,
    assessment_data_from_model,
    build_clinical_awareness,
    compute_clinical_acuity,
    normalize_tier,
    tier_from_probability,
)
from ai.fallback import format_risk_pct, get_fallback_assessment, round_risk_pct
import re

_ADMIT_ONLY_FACTOR_HINTS = (
    "apgar",
    "day of life",
    "gestational age",
    "term infant",
    "maternal age",
    "demographics",
)


def _is_assessment_model(model_used: str | None) -> bool:
    return "assessment" in (model_used or "").lower()


def sanitize_assessment_factors(assessment, factors: list | None) -> list[str]:
    """
    For assessment-model runs, keep bedside/change drivers only.
    Rewrite any leftover 'Birth weight' lines to current weight.
    """
    model_used = getattr(assessment, "model_used", None) or ""
    is_assess = _is_assessment_model(model_used)
    current_kg = getattr(assessment, "current_weight", None)
    if current_kg is None:
        current_kg = getattr(assessment, "birth_weight", None)

    out: list[str] = []
    seen: set[str] = set()
    for raw in factors or []:
        text = str(raw).strip()
        if not text:
            continue
        lower = text.lower()
        if is_assess:
            if any(h in lower for h in _ADMIT_ONLY_FACTOR_HINTS):
                continue
            if "birth weight" in lower:
                if current_kg is None:
                    continue
                cw = round(float(current_kg), 1)
                if cw < 1.5:
                    text = f"Current weight <1.5 kg ({cw:.1f} kg)"
                elif cw < 2.5:
                    text = f"Current weight 1.5–2.49 kg ({cw:.1f} kg)"
                else:
                    text = f"Current weight {cw:.1f} kg"
        if text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _neighbor_assessments(assessment):
    """Return (baseline first assessment, previous assessment) for the same patient."""
    qs = assessment.patient.assessments.order_by("created_at", "id")
    first = qs.first()
    previous = (
        qs.filter(created_at__lt=assessment.created_at)
        .order_by("-created_at", "-id")
        .first()
    )
    if previous is None and first is not None and first.id != assessment.id:
        previous = (
            qs.exclude(pk=assessment.pk)
            .filter(id__lt=assessment.id)
            .order_by("-id")
            .first()
        )
    return first, previous


def _payload_with_aligned_tier(payload: dict) -> dict:
    """Force mortality_tier to match mortality_probability (never trust a stale badge)."""
    prob = round_risk_pct(float(payload["mortality_probability"]))
    tier = tier_from_probability(prob)
    return {
        **payload,
        "mortality_probability": prob,
        "mortality_tier": tier,
        "intervention_window": payload.get("intervention_window")
        or INTERVENTION_WINDOWS.get(tier, INTERVENTION_WINDOWS["Low"]),
    }


def _sync_summary_probability(summary: str, probability: float) -> str:
    """Keep embedded % in care-note text matched to the displayed model probability."""
    pct = format_risk_pct(probability)
    if not summary:
        return summary
    updated, n = re.subn(
        r"Estimated 28-day risk:\s*[\d.]+%",
        f"Estimated 28-day risk: {pct}%",
        summary,
        count=1,
    )
    return updated if n else summary


def _narrative_for_run(assessment, payload: dict) -> dict:
    """Use the narrative saved with that model run; fill gaps only if empty."""
    stored_summary = (getattr(assessment, "ai_summary", None) or "").strip()
    stored_recs = list(getattr(assessment, "ai_recommendations", None) or [])
    stored_diffs = list(getattr(assessment, "ai_differentials", None) or [])

    fallback = get_fallback_assessment(
        payload["mortality_tier"],
        payload["mortality_factors"],
        payload["mortality_probability"],
    )
    summary = _sync_summary_probability(
        stored_summary or fallback["summary"],
        payload["mortality_probability"],
    )
    return {
        "summary": summary,
        "recommendations": stored_recs or fallback["recommendations"],
        "differentials": stored_diffs or fallback["differentials"],
    }


def _stored_risk_payload(assessment) -> dict | None:
    """Use the probability / factors / window saved at prediction time."""
    if assessment.mortality_probability is None:
        return None
    prob = round_risk_pct(float(assessment.mortality_probability))
    tier = tier_from_probability(prob)
    stored_window = (getattr(assessment, "intervention_window", None) or "").strip()
    factors = sanitize_assessment_factors(
        assessment,
        assessment.mortality_factors or assessment.risk_factors or [],
    )
    return {
        "mortality_probability": prob,
        "mortality_tier": tier,
        "mortality_factors": factors,
        "model_confidence": assessment.model_confidence
        or "Stored assessment (incomplete live features)",
        "model_source": assessment.model_used or "stored-assessment",
        "intervention_window": stored_window
        or INTERVENTION_WINDOWS.get(tier, INTERVENTION_WINDOWS["Low"]),
    }


def clinical_awareness_for_assessment(assessment, payload: dict | None = None) -> dict:
    """Build dual-score awareness (baseline vs current). First admit → identical scores."""
    payload = payload or aligned_assessment_payload(assessment)
    clinical = assessment_data_from_model(assessment)
    first, previous = _neighbor_assessments(assessment)
    is_reassess = previous is not None

    # Admission baseline is ALWAYS the first saved admit score (admit model).
    # Never recompute it with the reassess model — only current risk updates.
    if not is_reassess:
        baseline_probability = payload["mortality_probability"]
        baseline_tier = payload["mortality_tier"]
    elif first is not None and first.mortality_probability is not None:
        baseline_probability = round_risk_pct(float(first.mortality_probability))
        baseline_tier = tier_from_probability(baseline_probability)
    else:
        baseline_probability = payload["mortality_probability"]
        baseline_tier = payload["mortality_tier"]

    previous_probability = None
    previous_acuity_score = None
    previous_factors: list[str] = []
    if previous is not None:
        previous_probability = previous.mortality_probability
        previous_acuity_score = compute_clinical_acuity(
            assessment_data_from_model(previous)
        )["score"]
        previous_factors = sanitize_assessment_factors(
            previous,
            previous.mortality_factors or previous.risk_factors or [],
        )

    return build_clinical_awareness(
        clinical_data=clinical,
        mortality_probability=payload["mortality_probability"],
        mortality_tier=payload["mortality_tier"],
        mortality_factors=sanitize_assessment_factors(
            assessment, payload.get("mortality_factors") or []
        ),
        baseline_probability=baseline_probability,
        baseline_tier=baseline_tier,
        previous_probability=previous_probability,
        previous_acuity_score=previous_acuity_score,
        previous_factors=previous_factors,
        is_reassess=is_reassess,
    )


def aligned_assessment_payload(assessment) -> dict:
    """Care note + risk display must match the last model run stored on this assessment."""
    payload = _stored_risk_payload(assessment)

    if payload is None:
        clinical = assessment_data_from_model(assessment)
        try:
            from ai.ml_predictor import predict_risk

            payload = predict_risk(clinical)
        except Exception:
            payload = None
        if payload is None:
            payload = aligned_risk_payload(clinical)
        payload = _payload_with_aligned_tier(payload)

    ai = _narrative_for_run(assessment, payload)
    return {
        **payload,
        "ai_summary": ai["summary"],
        "ai_recommendations": ai["recommendations"],
        "ai_differentials": ai["differentials"],
        "model_source": assessment.model_used or payload.get("model_source") or "",
    }


def latest_assessment_payload(assessment) -> dict:
    """Return latest assessment fields with tier and probability always aligned."""
    if assessment is None:
        return None
    payload = aligned_assessment_payload(assessment)
    return {
        "id": assessment.id,
        "gestational_age": assessment.gestational_age,
        "birth_weight": assessment.birth_weight,
        "current_weight": assessment.current_weight
        if assessment.current_weight is not None
        else assessment.birth_weight,
        "risk_probability": payload["mortality_probability"],
        "risk_tier": payload["mortality_tier"],
        "risk_factors": payload["mortality_factors"],
        "mortality_probability": payload["mortality_probability"],
        "mortality_tier": payload["mortality_tier"],
        "mortality_factors": payload["mortality_factors"],
        "model_confidence": payload["model_confidence"],
        "intervention_window": payload["intervention_window"],
        "ai_summary": payload["ai_summary"],
        "ai_recommendations": payload["ai_recommendations"],
        "ai_differentials": payload["ai_differentials"],
        "created_at": assessment.created_at,
        "apgar_1min": assessment.apgar_1min,
        "apgar_5min": assessment.apgar_5min,
        "temperature": assessment.temperature,
        "heart_rate": assessment.heart_rate,
        "spo2": assessment.spo2,
        "respiratory_rate": assessment.respiratory_rate,
        "blood_glucose": assessment.blood_glucose,
        "sepsis": assessment.sepsis,
        "respiratory_distress_syndrome": assessment.respiratory_distress_syndrome,
        "birth_asphyxia": assessment.birth_asphyxia,
        "respiratory_distress_grade": getattr(
            assessment, "respiratory_distress_grade", None
        )
        or (
            "Moderate"
            if assessment.respiratory_distress_syndrome
            else "None"
        ),
        "birth_asphyxia_grade": getattr(assessment, "birth_asphyxia_grade", None)
        or ("Moderate" if assessment.birth_asphyxia else "None"),
        "multiple_birth": assessment.multiple_birth,
        "model_used": payload.get("model_source") or assessment.model_used or "",
        "clinical_awareness": clinical_awareness_for_assessment(assessment, payload),
    }
