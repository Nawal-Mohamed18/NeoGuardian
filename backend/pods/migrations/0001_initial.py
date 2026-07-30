from django.db import migrations, models


DEFAULT_PODS = [
    {'name': 'NICU Pod A', 'description': 'Primary NICU pod — level III care', 'bed_capacity': 12},
    {'name': 'NICU Pod B', 'description': 'Secondary NICU pod — step-down and overflow', 'bed_capacity': 10},
    {'name': 'NICU Pod C', 'description': 'Isolation and high-acuity pod', 'bed_capacity': 8},
]


def seed_pods(apps, schema_editor):
    Pod = apps.get_model('pods', 'Pod')
    for row in DEFAULT_PODS:
        Pod.objects.get_or_create(name=row['name'], defaults=row)


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Pod',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('bed_capacity', models.PositiveIntegerField(default=12)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.RunPython(seed_pods, migrations.RunPython.noop),
    ]
