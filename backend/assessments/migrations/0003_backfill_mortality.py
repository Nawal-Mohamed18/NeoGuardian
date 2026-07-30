"""Backfill mortality predictions on existing assessments."""

from django.db import migrations

from ai.mortality_engine import predict_mortality


def backfill_mortality(apps, schema_editor):
    Assessment = apps.get_model('assessments', 'Assessment')
    for a in Assessment.objects.iterator():
        data = {
            'gestational_age': a.gestational_age,
            'birth_weight': a.birth_weight,
            'mother_age': a.mother_age,
            'apgar_5min': a.apgar_5min,
            'apgar_1min': a.apgar_1min,
            'respiratory_support': a.respiratory_support,
            'feeding_difficulty': a.feeding_difficulty,
            'spo2': a.spo2,
            'heart_rate': a.heart_rate,
            'temperature': a.temperature,
        }
        result = predict_mortality(data, risk_score=a.risk_score)
        a.mortality_probability = result['mortality_probability']
        a.mortality_tier = result['mortality_tier']
        a.mortality_factors = result['mortality_factors']
        a.model_confidence = result['model_confidence']
        a.intervention_window = result['intervention_window']
        a.save(update_fields=[
            'mortality_probability', 'mortality_tier', 'mortality_factors',
            'model_confidence', 'intervention_window',
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0002_mortality_fields'),
    ]

    operations = [
        migrations.RunPython(backfill_mortality, migrations.RunPython.noop),
    ]
