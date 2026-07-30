from django.db import migrations, models

LEGACY_TO_ROLE = {
    'neonatologist': 'doctor',
    'developer': 'admin',
    'researcher': 'admin',
    'midwife': 'nurse',
    'lab_tech': 'nurse',
    'pharmacist': 'nurse',
}


def migrate_roles(apps, schema_editor):
    UserProfile = apps.get_model('accounts', 'UserProfile')
    for profile in UserProfile.objects.all():
        if profile.role in LEGACY_TO_ROLE:
            profile.role = LEGACY_TO_ROLE[profile.role]
            profile.save(update_fields=['role'])
        elif profile.role not in ('admin', 'nurse', 'doctor'):
            profile.role = 'doctor'
            profile.save(update_fields=['role'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(migrate_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='userprofile',
            name='role',
            field=models.CharField(
                choices=[('admin', 'Admin'), ('nurse', 'Nurse'), ('doctor', 'Doctor')],
                default='doctor',
                max_length=20,
            ),
        ),
    ]
