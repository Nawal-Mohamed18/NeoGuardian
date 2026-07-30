from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsNurseOrDoctor, IsAdmin
from assessments.serializers import AssessmentSerializer
from dashboard.scoping import filter_patients_for_user
from pods.capacity import ensure_bed_available, ensure_bed_number_unique, normalize_bed_number
from pods.models import Pod

from .models import Patient
from .serializers import AdmitPatientSerializer, HospitalPatientUpdateSerializer, PatientSerializer


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.select_related(
        "maternal", "pod", "admitted_by", "admitted_by__profile"
    ).prefetch_related("assessments").all()
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        # Admin-only lifecycle / registry actions
        if self.action in ("destroy", "update", "partial_update", "discharge", "transfer"):
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ("create", "admit"):
            return [IsAuthenticated(), IsNurseOrDoctor()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return HospitalPatientUpdateSerializer
        return PatientSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(PatientSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def get_queryset(self):
        qs = filter_patients_for_user(super().get_queryset(), self.request.user)
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")
        pod_id = self.request.query_params.get("pod")
        if search:
            qs = qs.filter(
                Q(patient_code__icontains=search)
                | Q(display_name__icontains=search)
                | Q(gender__icontains=search)
                | Q(maternal__full_name__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)
        if pod_id:
            qs = qs.filter(pod_id=pod_id)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["post"], url_path="admit")
    def admit(self, request):
        serializer = AdmitPatientSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        patient, assessment = serializer.save()
        # Safety net: never leave an admit without an admitting clinician.
        if patient.admitted_by_id is None and request.user.is_authenticated:
            patient.admitted_by = request.user
            patient.save(update_fields=["admitted_by"])
        data = PatientSerializer(patient).data
        if assessment is not None:
            data["assessment"] = AssessmentSerializer(assessment).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="discharge")
    def discharge(self, request, pk=None):
        """Admin: leave NICU — free bed/pod; clinical staff no longer see the patient."""
        patient = self.get_object()
        if patient.status != Patient.Status.ACTIVE:
            return Response({"detail": "Patient is not currently active."}, status=status.HTTP_400_BAD_REQUEST)
        patient.status = Patient.Status.DISCHARGED
        patient.pod = None
        patient.bed_number = ""
        patient.save(update_fields=["status", "pod", "bed_number"])
        return Response(PatientSerializer(patient).data)

    @action(detail=True, methods=["post"], url_path="transfer")
    def transfer(self, request, pk=None):
        """Admin: move patient from current POD to another POD."""
        patient = self.get_object()
        if patient.status != Patient.Status.ACTIVE:
            return Response({"detail": "Only active patients can be transferred."}, status=status.HTTP_400_BAD_REQUEST)

        pod_id = request.data.get("pod_id")
        bed_number = (request.data.get("bed_number") or "").strip()
        if not pod_id:
            return Response({"detail": "pod_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dest = Pod.objects.get(pk=pod_id, is_active=True)
        except Pod.DoesNotExist:
            return Response({"detail": "Destination POD not found or inactive."}, status=status.HTTP_400_BAD_REQUEST)

        if patient.pod_id == dest.id:
            return Response({"detail": "Patient is already in that POD."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ensure_bed_available(dest)
        except DjangoValidationError as exc:
            msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        bed = normalize_bed_number(bed_number)
        if bed:
            try:
                ensure_bed_number_unique(dest, bed, exclude_patient_id=patient.pk)
            except DjangoValidationError as exc:
                msg = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
                return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        patient.pod = dest
        if bed:
            patient.bed_number = bed
        patient.status = Patient.Status.ACTIVE
        patient.save(update_fields=["pod", "bed_number", "status"])
        return Response(PatientSerializer(patient).data)
