from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0002_patient_risk_level'),
    ]

    operations = [
        migrations.AddField(
            model_name='patient',
            name='outcome_28d',
            field=models.CharField(
                choices=[('unknown', 'Unknown'), ('survived', 'Survived'), ('deceased', 'Deceased')],
                default='unknown',
                max_length=20,
            ),
        ),
    ]
