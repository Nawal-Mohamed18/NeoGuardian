from rest_framework import serializers
from .models import Assessment
from .risk_display import aligned_assessment_payload, clinical_awareness_for_assessment


class AssessmentSerializer(serializers.ModelSerializer):
    patient_code = serializers.CharField(source='patient.patient_code', read_only=True)
    clinical_awareness = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            'id', 'patient', 'patient_code',
            'birth_weight', 'current_weight', 'gestational_age', 'mother_age', 'gender',
            'apgar_1min', 'apgar_5min', 'apgar_1min_components', 'apgar_5min_components',
            'temperature', 'heart_rate', 'spo2', 'respiratory_rate', 'blood_glucose',
            'clinical_status', 'risk_flags',
            'sepsis', 'respiratory_distress_syndrome', 'birth_asphyxia',
            'respiratory_distress_grade', 'birth_asphyxia_grade', 'multiple_birth',
            'risk_score', 'risk_level', 'risk_factors',
            'mortality_probability', 'mortality_tier', 'mortality_factors',
            'model_confidence', 'intervention_window',
            'ai_summary', 'ai_recommendations', 'ai_differentials', 'model_used',
            'clinical_awareness',
            'created_at',
        ]
        read_only_fields = [
            'risk_score', 'risk_level', 'risk_factors',
            'mortality_probability', 'mortality_tier', 'mortality_factors',
            'model_confidence', 'intervention_window',
            'ai_summary', 'ai_recommendations', 'ai_differentials', 'model_used',
            'clinical_awareness',
        ]

    def get_clinical_awareness(self, instance):
        return clinical_awareness_for_assessment(instance)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        payload = aligned_assessment_payload(instance)
        tier = payload["mortality_tier"]
        prob = payload["mortality_probability"]
        factors = payload["mortality_factors"]
        # Prefer risk_* naming in API responses
        data["risk_probability"] = prob
        data["risk_tier"] = tier
        data["risk_factors"] = factors
        data["mortality_probability"] = prob
        data["mortality_tier"] = tier
        data["mortality_factors"] = factors
        data["model_confidence"] = payload["model_confidence"]
        data["intervention_window"] = payload["intervention_window"]
        data["ai_summary"] = payload["ai_summary"]
        data["ai_recommendations"] = payload["ai_recommendations"]
        data["ai_differentials"] = payload["ai_differentials"]
        data["risk_level"] = tier
        # risk_score mirrors ML probability (%). Do NOT use legacy 25/55/85 labels.
        data["risk_score"] = prob
        if "model_source" in payload:
            data["model_used"] = payload["model_source"]
        data["clinical_awareness"] = clinical_awareness_for_assessment(instance, payload)
        return data


class AssessmentCreateSerializer(serializers.Serializer):
    patient_code = serializers.CharField(max_length=20)
    # Admit demographics are filled from the patient on create; not assessment-model inputs.
    gender = serializers.CharField(max_length=10, required=False, allow_blank=True)
    birth_weight = serializers.FloatField(required=False)
    gestational_age = serializers.IntegerField(required=False, min_value=20, max_value=45)
    mother_age = serializers.IntegerField(required=False, min_value=12, max_value=60)
    current_weight = serializers.FloatField(required=False, allow_null=True, min_value=0.3, max_value=8.0)

    apgar_1min = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=10)
    apgar_5min = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=10)
    apgar_1min_components = serializers.JSONField(required=False, allow_null=True)
    apgar_5min_components = serializers.JSONField(required=False, allow_null=True)
    clinical_status = serializers.ChoiceField(
        choices=['healthy', 'moderate', 'severe'], default='healthy'
    )
    risk_flags = serializers.ListField(
        child=serializers.CharField(max_length=40),
        required=False,
        default=list,
    )
    temperature = serializers.FloatField(required=False, allow_null=True)
    heart_rate = serializers.IntegerField(required=False, allow_null=True)
    respiratory_rate = serializers.IntegerField(required=False, allow_null=True)
    spo2 = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    blood_glucose = serializers.FloatField(required=True, min_value=10, max_value=600)
    sepsis = serializers.BooleanField(required=False, default=False)
    respiratory_distress_syndrome = serializers.BooleanField(required=False, default=False)
    birth_asphyxia = serializers.BooleanField(required=False, default=False)
    respiratory_distress_grade = serializers.ChoiceField(
        choices=["None", "Mild", "Moderate", "Severe"],
        required=False,
        default="None",
    )
    birth_asphyxia_grade = serializers.ChoiceField(
        choices=["None", "Mild", "Moderate", "Severe"],
        required=False,
        default="None",
    )
    multiple_birth = serializers.BooleanField(required=False, default=False)
    antenatal_visits = serializers.IntegerField(required=False, allow_null=True)
    maternal_hypertension = serializers.BooleanField(required=False, default=False)
    maternal_diabetes = serializers.BooleanField(required=False, default=False)
    delivery_vaginal = serializers.IntegerField(required=False, allow_null=True)
