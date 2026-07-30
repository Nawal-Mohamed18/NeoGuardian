from django.db import models
from patients.models import Patient
from assessments.models import Assessment


SEVERITY_CHOICES = [
    ('info', 'Info'),
    ('warning', 'Warning'),
    ('critical', 'Critical'),
]


class Alert(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name='alerts'
    )
    assessment = models.ForeignKey(
        Assessment, on_delete=models.SET_NULL, null=True, blank=True, related_name='alerts'
    )

    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='warning')
    title = models.CharField(max_length=200)
    message = models.TextField()
    acknowledged = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.patient.patient_code}"
