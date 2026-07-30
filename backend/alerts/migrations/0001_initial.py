# Generated manually for NeoGuardian MVP

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('assessments', '0001_initial'),
        ('patients', '0002_patient_risk_level'),
    ]

    operations = [
        migrations.CreateModel(
            name='Alert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('severity', models.CharField(choices=[('info', 'Info'), ('warning', 'Warning'), ('critical', 'Critical')], default='warning', max_length=10)),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('acknowledged', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('assessment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='alerts', to='assessments.assessment')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alerts', to='patients.patient')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
