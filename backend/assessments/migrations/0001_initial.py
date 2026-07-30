# Generated manually for NeoGuardian MVP

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('patients', '0002_patient_risk_level'),
    ]

    operations = [
        migrations.CreateModel(
            name='Assessment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('birth_weight', models.FloatField()),
                ('gestational_age', models.IntegerField()),
                ('mother_age', models.IntegerField()),
                ('gender', models.CharField(max_length=10)),
                ('apgar_1min', models.IntegerField(blank=True, null=True)),
                ('apgar_5min', models.IntegerField(blank=True, null=True)),
                ('respiratory_support', models.CharField(choices=[('none', 'None'), ('oxygen', 'Oxygen'), ('cpap', 'CPAP'), ('ventilation', 'Ventilation')], default='none', max_length=20)),
                ('feeding_difficulty', models.BooleanField(default=False)),
                ('temperature', models.FloatField(blank=True, null=True)),
                ('heart_rate', models.IntegerField(blank=True, null=True)),
                ('spo2', models.IntegerField(blank=True, null=True)),
                ('risk_score', models.FloatField()),
                ('risk_level', models.CharField(choices=[('Low', 'Low'), ('Medium', 'Medium'), ('High', 'High')], max_length=10)),
                ('risk_factors', models.JSONField(default=list)),
                ('ai_summary', models.TextField(blank=True)),
                ('ai_recommendations', models.JSONField(default=list)),
                ('ai_differentials', models.JSONField(default=list)),
                ('model_used', models.CharField(blank=True, max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assessments', to='patients.patient')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
