from django.db import migrations, models


def backfill_wards(apps, schema_editor):
    UserProfile = apps.get_model("accounts", "UserProfile")
    for profile in UserProfile.objects.all():
        primary = (profile.ward or "").strip()
        current = profile.wards if isinstance(profile.wards, list) else []
        names = []
        for item in current:
            name = str(item or "").strip()
            if name and name not in names:
                names.append(name)
        if primary and primary not in names:
            names.insert(0, primary)
        profile.wards = names
        profile.ward = names[0] if names else ""
        profile.save(update_fields=["wards", "ward"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_auditlog"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="wards",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(backfill_wards, migrations.RunPython.noop),
    ]
