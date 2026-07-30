from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from dashboard.scoping import filter_alerts_for_user, filter_patients_for_user, normalize_risk_tier
from assessments.risk_display import latest_assessment_payload
from patients.models import Patient

from .models import Alert
from .serializers import AlertSerializer
from .services import sync_stale_risk_alerts


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related("patient", "assessment").all()
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        scoped = filter_alerts_for_user(super().get_queryset(), self.request.user)
        patient_ids = list(
            filter_patients_for_user(
                Patient.objects.filter(status="active"),
                self.request.user,
            ).values_list("id", flat=True)
        )
        # Also reconcile discharged patients that still have open alerts in scope.
        open_patient_ids = list(scoped.filter(acknowledged=False).values_list("patient_id", flat=True))
        sync_stale_risk_alerts(list(set(patient_ids) | set(open_patient_ids)))
        return filter_alerts_for_user(super().get_queryset(), self.request.user)

    @action(detail=True, methods=["patch"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.acknowledged = True
        alert.save()
        return Response(AlertSerializer(alert).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def alert_summary(request):
    patients_qs = filter_patients_for_user(
        Patient.objects.filter(status="active"),
        request.user,
    )
    patient_ids = list(patients_qs.values_list("id", flat=True))
    sync_stale_risk_alerts(patient_ids)
    alerts_qs = Alert.objects.filter(acknowledged=False, patient_id__in=patient_ids)

    high_patients = 0
    medium_patients = 0
    low_patients = 0
    for patient in patients_qs.prefetch_related("assessments"):
        assessment = patient.assessments.first()
        if assessment is None:
            low_patients += 1
            continue
        tier = normalize_risk_tier(latest_assessment_payload(assessment)["mortality_tier"])
        if tier == "high":
            high_patients += 1
        elif tier == "medium":
            medium_patients += 1
        else:
            low_patients += 1

    return Response({
        "critical": alerts_qs.filter(severity="critical").count(),
        "warning": alerts_qs.filter(severity="warning").count(),
        "info": alerts_qs.filter(severity="info").count(),
        "total_active": alerts_qs.count(),
        "high_risk_patients": high_patients,
        "medium_risk_patients": medium_patients,
        "low_risk_patients": low_patients,
        "total_patients": patients_qs.count(),
    })
