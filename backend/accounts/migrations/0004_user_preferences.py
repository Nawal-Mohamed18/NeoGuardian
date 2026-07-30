from django.db import migrations, models


DEFAULT_PREFERENCES = {
    "email_alerts": True,
    "high_risk_alerts": True,
    "moderate_risk_alerts": True,
    "chat_notifications": True,
    "dashboard_compact": False,
    "auto_refresh_dashboard": True,
    "sound_alerts": False,
    "assessment_confirm_before_submit": True,
    "time_format": "12h",
}


def seed_preferences(apps, schema_editor):
    UserProfile = apps.get_model("accounts", "UserProfile")
    for profile in UserProfile.objects.all():
        if not profile.preferences:
            profile.preferences = DEFAULT_PREFERENCES.copy()
            profile.save(update_fields=["preferences"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_userprofile_ward"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(seed_preferences, migrations.RunPython.noop),
    ]
