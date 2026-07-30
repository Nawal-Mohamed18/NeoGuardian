"""Shared assessment creation — full clinical assessment for nurses and doctors."""

from patients.models import Patient
from alerts.services import upsert_risk_alert
from ai.model_features import extract_model_features_for_prediction
from ai.risk_engine import aligned_risk_payload
from ai.fallback import get_fallback_assessment

from .models import Assessment


def _create_alert_if_needed(patient, assessment):
    """Create/refresh clinical alert from the live-aligned payload for this assessment."""
    from assessments.risk_display import aligned_assessment_payload

    payload = aligned_assessment_payload(assessment)
    return upsert_risk_alert(patient, assessment, payload)


def _enrich_from_patient(patient: Patient, data: dict) -> dict:
    """
    Fill / lock birth-time and maternal features from the saved patient record.
    Reassessment must never replace these with form defaults.
    """
    out = dict(data)
    maternal = getattr(patient, "maternal", None)

    out["mother_age"] = patient.mother_age
    out["birth_weight"] = patient.birth_weight
    out["gestational_age"] = patient.gestational_age
    out["gender"] = patient.gender or out.get("gender", "")

    if patient.apgar_1min is not None:
        out["apgar_1min"] = patient.apgar_1min
    if patient.apgar_5min is not None:
        out["apgar_5min"] = patient.apgar_5min

    if maternal is not None:
        out["antenatal_visits"] = maternal.anc_visits
        out["maternal_hypertension"] = maternal.hypertension
        out["maternal_diabetes"] = maternal.gestational_diabetes

    delivery = getattr(patient, "delivery_type", "") or ""
    out["delivery_type"] = delivery
    out["delivery_vaginal"] = 1 if delivery in ("", "normal_vaginal", "assisted_forceps") else 0

    # Multiple birth is a birth fact — prefer earliest assessment if omitted.
    if "multiple_birth" not in out or out.get("multiple_birth") is None:
        first = patient.assessments.order_by("created_at", "id").first()
        if first is not None:
            out["multiple_birth"] = bool(first.multiple_birth)

    # Prefer stored APGAR component breakdowns from the patient record.
    if out.get("apgar_1min_components") is None and getattr(patient, "apgar_1min_components", None):
        out["apgar_1min_components"] = patient.apgar_1min_components
    if out.get("apgar_5min_components") is None and getattr(patient, "apgar_5min_components", None):
        out["apgar_5min_components"] = patient.apgar_5min_components

    return out


def _predict_for_assessment(patient: Patient, data: dict, *, risk_model: str) -> dict:
    """
    risk_model:
      - "admit"  → admission Balanced RF (models/)
      - "assess" → reassess Balanced RF (assessment_model/)
    """
    if risk_model == "assess":
        from ai.assessment_predictor import predict_assessment_risk

        ml = predict_assessment_risk(data, patient=patient)
        if ml is not None:
            return ml

    # Admit path, or assess fallback if assessment artifacts unavailable.
    model_input = extract_model_features_for_prediction(data)
    return aligned_risk_payload(model_input)


def create_assessment(patient: Patient, data: dict, *, risk_model: str = "assess") -> Assessment:
    """
    Persist an assessment and run prediction.

    Default risk_model="assess" for the Django assess API.
    Admit wizard must pass risk_model="admit".
    """
    data = _enrich_from_patient(patient, data)
    birth_kg = float(patient.birth_weight)
    current_raw = data.get("current_weight")
    current_kg = float(current_raw) if current_raw is not None else (
        float(patient.current_weight) if getattr(patient, "current_weight", None) is not None else birth_kg
    )
    data = {
        **data,
        "birth_weight": birth_kg,
        "current_weight": current_kg,
    }

    mortality_result = _predict_for_assessment(patient, data, risk_model=risk_model)
    ai_result = get_fallback_assessment(
        mortality_result["mortality_tier"],
        mortality_result["mortality_factors"],
        mortality_result["mortality_probability"],
    )

    assessment = Assessment.objects.create(
        patient=patient,
        birth_weight=birth_kg,
        current_weight=current_kg,
        gestational_age=data["gestational_age"],
        mother_age=data["mother_age"],
        gender=data["gender"],
        apgar_1min=data.get("apgar_1min"),
        apgar_5min=data.get("apgar_5min"),
        apgar_1min_components=data.get("apgar_1min_components"),
        apgar_5min_components=data.get("apgar_5min_components"),
        respiratory_support="none",
        feeding_difficulty=False,
        temperature=data.get("temperature"),
        heart_rate=data.get("heart_rate"),
        spo2=data.get("spo2"),
        respiratory_rate=data.get("respiratory_rate"),
        blood_glucose=data.get("blood_glucose"),
        clinical_status=data.get("clinical_status", "healthy"),
        risk_flags=data.get("risk_flags") or [],
        sepsis=bool(data.get("sepsis", False)),
        respiratory_distress_syndrome=(
            str(data.get("respiratory_distress_grade") or "").strip() not in ("", "None")
            if data.get("respiratory_distress_grade") is not None
            else bool(data.get("respiratory_distress_syndrome", False))
        ),
        birth_asphyxia=(
            str(data.get("birth_asphyxia_grade") or "").strip() not in ("", "None")
            if data.get("birth_asphyxia_grade") is not None
            else bool(data.get("birth_asphyxia", False))
        ),
        respiratory_distress_grade=(
            str(data.get("respiratory_distress_grade") or "").strip()
            or (
                "Moderate"
                if data.get("respiratory_distress_syndrome")
                else "None"
            )
        ),
        birth_asphyxia_grade=(
            str(data.get("birth_asphyxia_grade") or "").strip()
            or ("Moderate" if data.get("birth_asphyxia") else "None")
        ),
        multiple_birth=bool(data.get("multiple_birth", False)),
        # risk_score stores ML probability (%), same as mortality_probability
        risk_score=mortality_result["mortality_probability"],
        risk_level=mortality_result["mortality_tier"],
        risk_factors=mortality_result["mortality_factors"],
        mortality_probability=mortality_result["mortality_probability"],
        mortality_tier=mortality_result["mortality_tier"],
        mortality_factors=mortality_result["mortality_factors"],
        model_confidence=mortality_result["model_confidence"],
        intervention_window=mortality_result["intervention_window"],
        ai_summary=ai_result.get("summary", ""),
        ai_recommendations=ai_result.get("recommendations", []),
        ai_differentials=ai_result.get("differentials", []),
        model_used=mortality_result.get("model_source", "clinical-rules-v2"),
    )

    # Persist latest current weight on the patient; never mutate birth_weight.
    patient.risk_level = assessment.mortality_tier
    patient.current_weight = current_kg
    patient.save(update_fields=["risk_level", "current_weight"])

    # All tiers create alerts so Clinical Alerts (High / Moderate / Low) stay in sync.
    _create_alert_if_needed(patient, assessment)

    if risk_model == "assess":
        from assessments.risk_display import clinical_awareness_for_assessment

        awareness = clinical_awareness_for_assessment(assessment)
        traj = awareness.get("trajectory") or {}
        direction = traj.get("direction")
        msg = (traj.get("message") or "").strip()
        if direction in ("improving", "worsening", "stable") and msg:
            summary = (assessment.ai_summary or "").strip()
            if msg not in summary:
                assessment.ai_summary = f"{msg} {summary}".strip()
                assessment.save(update_fields=["ai_summary"])

    return assessment
