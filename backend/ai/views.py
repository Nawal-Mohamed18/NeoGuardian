from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from patients.models import Patient
from assessments.serializers import AssessmentCreateSerializer
from assessments.risk_display import latest_assessment_payload
from ai.risk_engine import aligned_risk_payload, calculate_risk
from ai.llm_service import generate_assessment_narrative, generate_chat_reply
from ai.fallback import get_fallback_assessment


class ChatSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    message = serializers.CharField(max_length=2000)
    history = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )


class PredictSerializer(AssessmentCreateSerializer):
    """Dry-run mortality prediction — same intake as assessment, no persist."""


def _build_patient_context(patient: Patient) -> dict:
    latest = patient.assessments.first()
    assessment_count = patient.assessments.count()
    # First saved assessment = admission only → cite birth weight.
    # Any re-assessment → cite current (bedside) weight.
    is_first_assessment = assessment_count <= 1
    birth_kg = patient.birth_weight
    current_kg = (
        (latest.current_weight if latest and latest.current_weight is not None else None)
        or patient.current_weight
        or birth_kg
    )
    display_weight_kg = birth_kg if is_first_assessment else current_kg
    ctx = {
        "patient_code": patient.patient_code,
        "gender": patient.gender,
        "birth_weight_kg": birth_kg,
        "current_weight_kg": current_kg,
        "display_weight_kg": display_weight_kg,
        "display_weight_label": "birth weight" if is_first_assessment else "current weight",
        "is_first_assessment": is_first_assessment,
        "assessment_count": assessment_count,
        "gestational_age_weeks": patient.gestational_age,
        "mother_age": patient.mother_age,
        "pod_name": patient.pod.name if patient.pod_id and patient.pod else None,
        "bed_number": patient.bed_number,
        "apgar_1min": patient.apgar_1min,
        "apgar_5min": patient.apgar_5min,
    }
    if latest:
        payload = latest_assessment_payload(latest)
        awareness = payload.get("clinical_awareness") or {}
        ctx["clinical_awareness"] = awareness
        ctx["latest_vitals"] = {
            "temperature": latest.temperature,
            "heart_rate": latest.heart_rate,
            "spo2": latest.spo2,
            "respiratory_rate": latest.respiratory_rate,
            "blood_glucose": latest.blood_glucose,
        }
        ctx["clinical"] = {
            "sepsis": latest.sepsis,
            "respiratory_distress_syndrome": latest.respiratory_distress_syndrome,
            "birth_asphyxia": latest.birth_asphyxia,
            "respiratory_distress_grade": getattr(
                latest, "respiratory_distress_grade", None
            ),
            "birth_asphyxia_grade": getattr(latest, "birth_asphyxia_grade", None),
            "multiple_birth": latest.multiple_birth,
            "birth_weight_kg": latest.birth_weight,
            "current_weight_kg": latest.current_weight
            if latest.current_weight is not None
            else latest.birth_weight,
        }
        ctx["latest_mortality_prediction"] = {
            "mortality_probability": payload["mortality_probability"],
            "mortality_tier": payload["mortality_tier"],
            "mortality_factors": payload["mortality_factors"],
            "intervention_window": payload["intervention_window"],
            "model_confidence": payload["model_confidence"],
            "ai_summary": payload["ai_summary"],
            "recommendations": payload["ai_recommendations"],
            "differentials": payload["ai_differentials"],
            "model_used": payload.get("model_used") or latest.model_used,
            "apgar_1min": latest.apgar_1min,
            "apgar_5min": latest.apgar_5min,
        }
    return ctx


@api_view(['POST'])
def predict(request):
    """Dry-run mortality prediction without persisting."""
    serializer = PredictSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    mortality_result = aligned_risk_payload(data)
    risk_result = {
        **calculate_risk(data),
        'risk_level': mortality_result['mortality_tier'],
        # Same scale as mortality_probability (%) — never legacy 25/55/85 labels
        'risk_score': mortality_result['mortality_probability'],
        'risk_factors': mortality_result['mortality_factors'],
    }

    try:
        ai_result = generate_assessment_narrative(data, risk_result, mortality_result)
    except Exception:
        ai_result = get_fallback_assessment(
            mortality_result['mortality_tier'],
            mortality_result['mortality_factors'],
            mortality_result['mortality_probability'],
        )
        ai_result['model_used'] = 'fallback'

    return Response({
        **mortality_result,
        'risk_score': mortality_result['mortality_probability'],
        'risk_level': mortality_result['mortality_tier'],
        'ai_summary': ai_result.get('summary', ''),
        'ai_recommendations': ai_result.get('recommendations', []),
        'ai_differentials': ai_result.get('differentials', []),
        'model_used': mortality_result.get('model_source') or ai_result.get('model_used', 'hybrid-v1'),
    })


@api_view(['POST'])
def chat(request):
    serializer = ChatSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        patient = Patient.objects.select_related("pod").get(pk=data["patient_id"])
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    context = _build_patient_context(patient)
    result = generate_chat_reply(context, data['message'], data.get('history', []))

    return Response({
        'reply': result['reply'],
        'model_used': result['model_used'],
    })
