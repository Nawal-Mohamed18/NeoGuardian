import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("patients", "0008_clinical_workflow_weights_apgar"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="admitted_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Staff user who completed the admission (nurse or doctor)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="admitted_patients",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
