from django.db import models
from patients.models import Patient


RESPIRATORY_CHOICES = [
    ('none', 'None'),
    ('oxygen', 'Oxygen'),
    ('cpap', 'CPAP'),
    ('ventilation', 'Ventilation'),
]

RISK_LEVEL_CHOICES = [
    ('Low', 'Low'),
    ('Moderate', 'Moderate'),
    ('High', 'High'),
]


class Assessment(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name='assessments'
    )

    birth_weight = models.FloatField()
    # Weight at this assessment time. On admit equals birth_weight; on reassess may differ.
    # Admit RF uses birth_weight; assess RF uses CurrentWeight + WeightChangePct only.
    current_weight = models.FloatField(
        null=True,
        blank=True,
        help_text="Weight (kg) at assessment time for clinical tracking.",
    )
    gestational_age = models.IntegerField()
    mother_age = models.IntegerField()
    gender = models.CharField(max_length=10)

    apgar_1min = models.IntegerField(null=True, blank=True)
    apgar_5min = models.IntegerField(null=True, blank=True)
    apgar_1min_components = models.JSONField(null=True, blank=True)
    apgar_5min_components = models.JSONField(null=True, blank=True)
    respiratory_support = models.CharField(
        max_length=20, choices=RESPIRATORY_CHOICES, default='none'
    )
    feeding_difficulty = models.BooleanField(default=False)
    temperature = models.FloatField(null=True, blank=True)
    heart_rate = models.IntegerField(null=True, blank=True)
    spo2 = models.IntegerField(null=True, blank=True)
    respiratory_rate = models.IntegerField(null=True, blank=True)
    blood_glucose = models.FloatField(null=True, blank=True)
    clinical_status = models.CharField(max_length=20, default='healthy')
    risk_flags = models.JSONField(default=list)
    sepsis = models.BooleanField(default=False)
    respiratory_distress_syndrome = models.BooleanField(default=False)
    birth_asphyxia = models.BooleanField(default=False)
    # Persist Mild/Moderate/Severe so reassess prefills the same grade (not invent Moderate).
    respiratory_distress_grade = models.CharField(max_length=12, default="None", blank=True)
    birth_asphyxia_grade = models.CharField(max_length=12, default="None", blank=True)
    multiple_birth = models.BooleanField(default=False)

    risk_score = models.FloatField()
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES)
    risk_factors = models.JSONField(default=list)

    mortality_probability = models.FloatField(default=0)
    mortality_tier = models.CharField(max_length=12, default='Low')
    mortality_factors = models.JSONField(default=list)
    model_confidence = models.FloatField(default=0.6)
    intervention_window = models.CharField(max_length=64, blank=True)

    ai_summary = models.TextField(blank=True)
    ai_recommendations = models.JSONField(default=list)
    ai_differentials = models.JSONField(default=list)
    model_used = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.patient.patient_code} - {self.risk_level} ({self.created_at:%Y-%m-%d})"
