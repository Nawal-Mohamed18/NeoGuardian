# Generated manually for presence tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_userprofile_wards"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="last_seen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
