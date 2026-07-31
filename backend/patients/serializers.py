from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from assessments.risk_display import latest_assessment_payload
from pods.models import Pod
from pods.capacity import ensure_bed_available, ensure_bed_number_unique, normalize_bed_number

from .models import MaternalProfile, Patient


class MaternalProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaternalProfile
        fields = [
            "id", "hospital_mrn", "full_name", "age", "blood_group", "hiv_status",
            "gravida", "parity", "gestational_diabetes", "hypertension", "anc_visits",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PatientSerializer(serializers.ModelSerializer):
    latest_assessment = serializers.SerializerMethodField()
    maternal = MaternalProfileSerializer(read_only=True)
    pod_name = serializers.CharField(source="pod.name", read_only=True, allow_null=True)
    admitted_by_name = serializers.SerializerMethodField()
    admitted_by_role = serializers.SerializerMethodField()
    admitted_by_username = serializers.CharField(
        source="admitted_by.username", read_only=True, default=None, allow_null=True
    )

    class Meta:
        model = Patient
        fields = [
            "id", "patient_code", "display_name", "gender", "birth_weight", "current_weight",
            "gestational_age", "gestational_age_days", "mother_age", "outcome_28d",
            "pod", "pod_name", "bed_number", "delivery_type", "apgar_1min", "apgar_5min",
            "apgar_1min_components", "apgar_5min_components",
            "status", "admission_date", "admitted_by_name", "admitted_by_role", "admitted_by_username",
            "maternal", "risk_level", "created_at",
            "latest_assessment",
        ]
        read_only_fields = ["patient_code", "created_at", "risk_level"]

    def validate_patient_code(self, value):
        code = value.strip()
        if not code:
            raise serializers.ValidationError("Patient code is required.")
        qs = Patient.objects.filter(patient_code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A newborn with this patient code already exists.")
        return code

    def get_latest_assessment(self, obj):
        assessment = obj.assessments.first()
        return latest_assessment_payload(assessment)

    def _admitted_profile(self, obj):
        user = getattr(obj, "admitted_by", None)
        if not user:
            return None
        return getattr(user, "profile", None)

    def get_admitted_by_name(self, obj):
        user = getattr(obj, "admitted_by", None)
        if not user:
            return None
        profile = self._admitted_profile(obj)
        if profile and profile.full_name:
            return profile.full_name
        return user.get_full_name() or user.username

    def get_admitted_by_role(self, obj):
        profile = self._admitted_profile(obj)
        return profile.role if profile else None


class HospitalPatientUpdateSerializer(serializers.ModelSerializer):
    """Admin edit: hospital placement fields only — no clinical vitals."""

    class Meta:
        model = Patient
        fields = ["display_name", "bed_number"]

    def validate_bed_number(self, value):
        bed = normalize_bed_number(value)
        patient = self.instance
        if patient and patient.pod_id and bed:
            try:
                ensure_bed_number_unique(patient.pod, bed, exclude_patient_id=patient.pk)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(
                    exc.messages[0] if getattr(exc, "messages", None) else str(exc)
                )
        return bed

    def update(self, instance, validated_data):
        if "bed_number" in validated_data:
            validated_data["bed_number"] = normalize_bed_number(validated_data.get("bed_number"))
        return super().update(instance, validated_data)

class AdmitPatientSerializer(serializers.Serializer):
    """Compound admit from neotLife-style wizard: maternal + neonatal (+ optional vitals/assessment)."""

    # Maternal
    hospital_mrn = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    mother_name = serializers.CharField(max_length=200)
    mother_age = serializers.IntegerField(min_value=12, max_value=60)
    blood_group = serializers.CharField(max_length=10, required=False, default="O+")
    hiv_status = serializers.CharField(max_length=50, required=False, default="Non-reactive (Negative)")
    gravida = serializers.IntegerField(min_value=0, required=False, default=1)
    parity = serializers.IntegerField(min_value=0, required=False, default=0)
    gestational_diabetes = serializers.BooleanField(required=False, default=False)
    hypertension = serializers.BooleanField(required=False, default=False)
    anc_visits = serializers.IntegerField(min_value=0, required=False, default=0)

    # Neonatal
    display_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    gender = serializers.ChoiceField(choices=["male", "female", "Male", "Female", "M", "F", "Other"])
    birth_weight_grams = serializers.IntegerField(min_value=300, max_value=7000)
    gestational_age_weeks = serializers.IntegerField(min_value=20, max_value=45)
    gestational_age_days = serializers.IntegerField(min_value=0, max_value=6, required=False, default=0)
    apgar_1min = serializers.IntegerField(min_value=0, max_value=10, required=False, allow_null=True)
    apgar_5min = serializers.IntegerField(min_value=0, max_value=10, required=False, allow_null=True)
    apgar_1min_components = serializers.JSONField(required=False, allow_null=True)
    apgar_5min_components = serializers.JSONField(required=False, allow_null=True)
    delivery_type = serializers.ChoiceField(
        choices=[c[0] for c in Patient.DeliveryType.choices],
        default=Patient.DeliveryType.NORMAL_VAGINAL,
    )
    pod_id = serializers.IntegerField(required=False, allow_null=True)
    bed_number = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    # Optional current weight at admit (grams). Defaults to birth weight when omitted.
    current_weight_grams = serializers.IntegerField(
        min_value=300, max_value=8000, required=False, allow_null=True
    )

    # Optional vitals → first assessment
    run_assessment = serializers.BooleanField(required=False, default=True)
    heart_rate = serializers.IntegerField(required=False, allow_null=True)
    spo2 = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    respiratory_rate = serializers.IntegerField(required=False, allow_null=True)
    temperature = serializers.FloatField(required=False, allow_null=True)
    complication_type = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    blood_glucose = serializers.FloatField(required=True, min_value=10, max_value=600)
    sepsis = serializers.BooleanField(required=False, default=False)
    prolonged_rupture_of_membranes = serializers.BooleanField(required=False, default=False)
    respiratory_distress_syndrome = serializers.BooleanField(required=False, default=False)
    birth_asphyxia = serializers.BooleanField(required=False, default=False)
    # Model ordinal grades: None / Mild / Moderate / Severe
    respiratory_distress_grade = serializers.ChoiceField(
        choices=["None", "Mild", "Moderate", "Severe"], required=False, default="None"
    )
    birth_asphyxia_grade = serializers.ChoiceField(
        choices=["None", "Mild", "Moderate", "Severe"], required=False, default="None"
    )
    multiple_birth = serializers.BooleanField(required=False, default=False)

    def validate_hospital_mrn(self, value):
        mrn = (value or "").strip()
        if not mrn:
            return ""
        if MaternalProfile.objects.filter(hospital_mrn__iexact=mrn).exists():
            raise serializers.ValidationError("A maternal profile with this MRN already exists.")
        return mrn

    def validate_pod_id(self, value):
        if value is None:
            return value
        try:
            pod = Pod.objects.get(pk=value, is_active=True)
        except Pod.DoesNotExist:
            raise serializers.ValidationError("Pod not found or inactive.")
        request = self.context.get("request")
        from accounts.permissions import ensure_user_profile
        from accounts.roles import canonical_role

        profile = ensure_user_profile(getattr(request, "user", None)) if request else None
        if profile and canonical_role(profile.role) in ("nurse", "doctor"):
            allowed = profile.assigned_pod_names()
            if pod.name not in allowed:
                raise serializers.ValidationError(
                    "You can only admit newborns to your assigned POD(s)."
                )
        try:
            ensure_bed_available(pod)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(str(exc.message if hasattr(exc, "message") else exc))
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bed = normalize_bed_number(attrs.get("bed_number", ""))
        attrs["bed_number"] = bed
        pod_id = attrs.get("pod_id")
        if pod_id and bed:
            pod = Pod.objects.filter(pk=pod_id, is_active=True).first()
            if pod:
                try:
                    ensure_bed_number_unique(pod, bed)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError(
                        {"bed_number": exc.messages[0] if getattr(exc, "messages", None) else str(exc)}
                    )
        return attrs

    def create(self, validated_data):
        from assessments.services import create_assessment
        from ai.model_features import build_model_features_from_admit

        # Clinical snapshot for AI (popped before registration persistence).
        run_assessment = validated_data.pop("run_assessment", True)
        clinical_snapshot = {
            "heart_rate": validated_data.pop("heart_rate", None),
            "spo2": validated_data.pop("spo2", None),
            "respiratory_rate": validated_data.pop("respiratory_rate", None),
            "temperature": validated_data.pop("temperature", None),
            "complication_type": validated_data.pop("complication_type", ""),
            "blood_glucose": validated_data.pop("blood_glucose", None),
            "sepsis": validated_data.pop("sepsis", False),
            "prolonged_rupture_of_membranes": validated_data.pop(
                "prolonged_rupture_of_membranes", False
            ),
            "respiratory_distress_syndrome": validated_data.pop(
                "respiratory_distress_syndrome", False
            ),
            "birth_asphyxia": validated_data.pop("birth_asphyxia", False),
            "respiratory_distress_grade": validated_data.pop(
                "respiratory_distress_grade", "None"
            ),
            "birth_asphyxia_grade": validated_data.pop("birth_asphyxia_grade", "None"),
            "multiple_birth": validated_data.pop("multiple_birth", False),
            "apgar_1min_components": validated_data.pop("apgar_1min_components", None),
            "apgar_5min_components": validated_data.pop("apgar_5min_components", None),
        }
        current_weight_grams = validated_data.pop("current_weight_grams", None)

        # --- Patient Registration Data (full record; not model input) ---
        pod_id = validated_data.pop("pod_id", None)
        birth_weight_grams = validated_data.pop("birth_weight_grams")
        ga_weeks = validated_data.pop("gestational_age_weeks")
        ga_days = validated_data.pop("gestational_age_days", 0)
        mother_name = validated_data.pop("mother_name")
        mother_age = validated_data["mother_age"]

        gender = validated_data.pop("gender")
        gender_norm = {"m": "Male", "male": "Male", "f": "Female", "female": "Female"}.get(
            gender.lower(), gender
        )

        maternal = MaternalProfile.objects.create(
            hospital_mrn=validated_data.get("hospital_mrn") or "",
            full_name=mother_name,
            age=mother_age,
            blood_group=validated_data.get("blood_group", "O+"),
            hiv_status=validated_data.get("hiv_status", "Non-reactive (Negative)"),
            gravida=validated_data.get("gravida", 1),
            parity=validated_data.get("parity", 0),
            gestational_diabetes=validated_data.get("gestational_diabetes", False),
            hypertension=validated_data.get("hypertension", False),
            anc_visits=validated_data.get("anc_visits", 0),
        )

        pod = Pod.objects.filter(pk=pod_id).first() if pod_id else None
        if pod:
            ensure_bed_available(pod)
            bed = normalize_bed_number(validated_data.get("bed_number", ""))
            if bed:
                ensure_bed_number_unique(pod, bed)
            validated_data["bed_number"] = bed

        birth_weight_kg = round(birth_weight_grams / 1000.0, 3)
        if current_weight_grams is not None:
            current_weight_kg = round(float(current_weight_grams) / 1000.0, 3)
        else:
            current_weight_kg = birth_weight_kg
        clinical_snapshot["current_weight"] = current_weight_kg
        display_name = validated_data.get("display_name") or f"{mother_name}'s baby"

        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        if user is None or not getattr(user, "is_authenticated", False):
            raise serializers.ValidationError(
                {"detail": "Authenticated staff required so admitting clinician can be recorded."}
            )
        admitted_by = user

        patient = Patient.objects.create(
            display_name=display_name,
            gender=gender_norm,
            birth_weight=birth_weight_kg,
            current_weight=current_weight_kg,
            gestational_age=ga_weeks,
            gestational_age_days=ga_days,
            mother_age=mother_age,
            maternal=maternal,
            pod=pod,
            bed_number=validated_data.get("bed_number", ""),
            delivery_type=validated_data.get("delivery_type", Patient.DeliveryType.NORMAL_VAGINAL),
            apgar_1min=validated_data.get("apgar_1min"),
            apgar_5min=validated_data.get("apgar_5min"),
            apgar_1min_components=clinical_snapshot.get("apgar_1min_components"),
            apgar_5min_components=clinical_snapshot.get("apgar_5min_components"),
            status=Patient.Status.ACTIVE,
            admitted_by=admitted_by,
        )

        # --- AI Model Features (filtered subset only, after patient is saved) ---
        assessment = None
        if run_assessment:
            model_features = build_model_features_from_admit(patient, clinical_snapshot)
            # Components are stored on the assessment but never sent into the RF feature row.
            model_features["apgar_1min_components"] = clinical_snapshot.get("apgar_1min_components")
            model_features["apgar_5min_components"] = clinical_snapshot.get("apgar_5min_components")
            model_features["current_weight"] = current_weight_kg
            assessment = create_assessment(patient, model_features, risk_model="admit")

        return patient, assessment
