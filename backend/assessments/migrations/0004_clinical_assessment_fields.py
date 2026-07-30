from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0003_backfill_mortality'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessment',
            name='respiratory_rate',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assessment',
            name='blood_glucose',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assessment',
            name='clinical_status',
            field=models.CharField(default='healthy', max_length=20),
        ),
        migrations.AddField(
            model_name='assessment',
            name='risk_flags',
            field=models.JSONField(default=list),
        ),
        migrations.AlterField(
            model_name='assessment',
            name='mortality_tier',
            field=models.CharField(default='Low', max_length=12),
        ),
        migrations.AlterField(
            model_name='assessment',
            name='risk_level',
            field=models.CharField(
                choices=[('Low', 'Low'), ('Moderate', 'Moderate'), ('High', 'High')],
                max_length=10,
            ),
        ),
    ]
