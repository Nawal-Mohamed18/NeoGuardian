from django.conf import settings
from django.db import models
from django.utils import timezone


class MaternalProfile(models.Model):
    hospital_mrn = models.CharField(max_length=50, unique=True, blank=True)
    full_name = models.CharField(max_length=200)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    blood_group = models.CharField(max_length=10, blank=True, default="O+")
    hiv_status = models.CharField(max_length=50, default="Non-reactive (Negative)")
    gravida = models.PositiveSmallIntegerField(default=1)
    parity = models.PositiveSmallIntegerField(default=0)
    gestational_diabetes = models.BooleanField(default=False)
    hypertension = models.BooleanField(default=False)
    anc_visits = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.hospital_mrn:
            last = MaternalProfile.objects.order_by("-id").first()
            num = (last.id if last else 0) + 1
            self.hospital_mrn = f"MAT-{num:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.hospital_mrn})"


class Patient(models.Model):
    class DeliveryType(models.TextChoices):
        NORMAL_VAGINAL = "normal_vaginal", "Normal Vaginal"
        EMERGENCY_CSECTION = "emergency_csection", "Emergency C-Section"
        ELECTIVE_CSECTION = "elective_csection", "Elective C-Section"
        ASSISTED_FORCEPS = "assisted_forceps", "Assisted Forceps"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DISCHARGED = "discharged", "Discharged"
        TRANSFERRED = "transferred", "Transferred"
        DECEASED = "deceased", "Deceased"

    patient_code = models.CharField(max_length=20, unique=True, blank=True)
    display_name = models.CharField(max_length=200, blank=True, default="")
    gender = models.CharField(max_length=10)
    risk_level = models.CharField(
        max_length=10,
        choices=[("High", "High"), ("Medium", "Medium"), ("Low", "Low"), ("Moderate", "Moderate")],
        default="Low",
    )
    birth_weight = models.FloatField(help_text="Birth weight in kg")
    current_weight = models.FloatField(
        null=True,
        blank=True,
        help_text="Latest recorded weight in kg (updated on reassess; birth_weight never changes)",
    )
    gestational_age = models.IntegerField(help_text="Gestational age in weeks")
    gestational_age_days = models.PositiveSmallIntegerField(default=0)
    mother_age = models.IntegerField()
    maternal = models.ForeignKey(
        MaternalProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="neonates"
    )
    pod = models.ForeignKey(
        "pods.Pod", on_delete=models.SET_NULL, null=True, blank=True, related_name="patients"
    )
    bed_number = models.CharField(max_length=20, blank=True, default="")
    delivery_type = models.CharField(
        max_length=30, choices=DeliveryType.choices, default=DeliveryType.NORMAL_VAGINAL
    )
    apgar_1min = models.PositiveSmallIntegerField(null=True, blank=True)
    apgar_5min = models.PositiveSmallIntegerField(null=True, blank=True)
    apgar_1min_components = models.JSONField(null=True, blank=True)
    apgar_5min_components = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    admission_date = models.DateTimeField(default=timezone.now)
    admitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admitted_patients",
        help_text="Staff user who completed the admission (nurse or doctor)",
    )
    outcome_28d = models.CharField(
        max_length=20,
        choices=[("unknown", "Unknown"), ("survived", "Survived"), ("deceased", "Deceased")],
        default="unknown",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.patient_code:
            last = Patient.objects.order_by("-id").first()
            num = (last.id if last else 0) + 1
            self.patient_code = f"NEO-{num:04d}"
        if not self.display_name:
            self.display_name = self.patient_code
        super().save(*args, **kwargs)

    def __str__(self):
        return self.patient_code
