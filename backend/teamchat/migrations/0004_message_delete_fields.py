from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("teamchat", "0003_teammessage_pod_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="teammessage",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="teammessage",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="deleted_team_messages",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="teammessage",
            name="deleted_for_everyone",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="teammessage",
            name="hidden_for",
            field=models.ManyToManyField(
                blank=True,
                help_text="Users who deleted this message for themselves only",
                related_name="hidden_team_messages",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
