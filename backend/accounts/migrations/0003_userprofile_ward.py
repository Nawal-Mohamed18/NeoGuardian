from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_simplify_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='ward',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
