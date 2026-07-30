from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.permissions import IsDoctorOrReadOnly
from dashboard.scoping import filter_patients_for_user
from patients.models import Patient

from .models import Assessment
from .serializers import AssessmentSerializer, AssessmentCreateSerializer
from .services import create_assessment


class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.select_related("patient").all()
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated, IsDoctorOrReadOnly]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        allowed = filter_patients_for_user(Patient.objects.all(), self.request.user)
        qs = qs.filter(patient_id__in=allowed.values_list("id", flat=True))
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def create(self, request, *args, **kwargs):
        input_serializer = AssessmentCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = dict(input_serializer.validated_data)

        # Reassess only — new admissions must go through POST /patients/admit/
        # (admit model). Creating a patient here would freeze the wrong baseline.
        existing = Patient.objects.filter(patient_code__iexact=data["patient_code"]).first()
        if existing is None:
            raise ValidationError(
                {
                    "patient_code": (
                        "Unknown patient. Admit the newborn first "
                        "(Admit Newborn), then re-assess from the patient chart."
                    )
                }
            )

        scoped = filter_patients_for_user(
            Patient.objects.filter(pk=existing.pk), request.user
        ).first()
        if scoped is None:
            raise PermissionDenied("You do not have access to this patient.")

        patient = existing
        data["gender"] = patient.gender
        data["birth_weight"] = patient.birth_weight
        data["gestational_age"] = patient.gestational_age
        data["mother_age"] = patient.mother_age
        if data.get("apgar_1min") is None and patient.apgar_1min is not None:
            data["apgar_1min"] = patient.apgar_1min
        if data.get("apgar_5min") is None and patient.apgar_5min is not None:
            data["apgar_5min"] = patient.apgar_5min
        if data.get("current_weight") is None:
            latest = patient.assessments.order_by("-created_at", "-id").first()
            if latest and latest.current_weight is not None:
                data["current_weight"] = latest.current_weight
            else:
                data["current_weight"] = patient.birth_weight
        if "multiple_birth" not in input_serializer.validated_data:
            latest = patient.assessments.order_by("-created_at", "-id").first()
            if latest is not None:
                data["multiple_birth"] = latest.multiple_birth

        assessment = create_assessment(patient, data, risk_model="assess")
        return Response(AssessmentSerializer(assessment).data, status=status.HTTP_201_CREATED)
