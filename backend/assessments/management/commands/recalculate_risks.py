"""Recompute and persist aligned risk tiers for all assessments."""

from django.core.management.base import BaseCommand

from assessments.models import Assessment
from assessments.risk_display import aligned_assessment_payload


class Command(BaseCommand):
    help = "Recalculate Low/Moderate/High from clinical rules"

    def handle(self, *args, **options):
        updated = 0
        for assessment in Assessment.objects.select_related("patient").iterator():
            payload = aligned_assessment_payload(assessment)
            assessment.mortality_tier = payload["mortality_tier"]
            assessment.mortality_probability = payload["mortality_probability"]
            assessment.mortality_factors = payload["mortality_factors"]
            assessment.model_confidence = payload["model_confidence"]
            assessment.intervention_window = payload["intervention_window"]
            assessment.risk_level = payload["mortality_tier"]
            # Store real ML probability (%), not legacy 25/55/85 labels
            assessment.risk_score = payload["mortality_probability"]
            assessment.risk_factors = payload["mortality_factors"]
            assessment.model_used = payload.get("model_source") or assessment.model_used
            assessment.ai_summary = payload["ai_summary"]
            assessment.ai_recommendations = payload["ai_recommendations"]
            assessment.ai_differentials = payload["ai_differentials"]
            assessment.save(update_fields=[
                "mortality_tier",
                "mortality_probability",
                "mortality_factors",
                "model_confidence",
                "intervention_window",
                "risk_level",
                "risk_score",
                "risk_factors",
                "model_used",
                "ai_summary",
                "ai_recommendations",
                "ai_differentials",
            ])
            patient = assessment.patient
            patient.risk_level = payload["mortality_tier"]
            patient.save(update_fields=["risk_level"])
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"Recalculated risk for {updated} assessment(s)."))
