from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='assessment',
            name='mortality_probability',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='assessment',
            name='mortality_tier',
            field=models.CharField(default='Minimal', max_length=12),
        ),
        migrations.AddField(
            model_name='assessment',
            name='mortality_factors',
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name='assessment',
            name='model_confidence',
            field=models.FloatField(default=0.6),
        ),
        migrations.AddField(
            model_name='assessment',
            name='intervention_window',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
