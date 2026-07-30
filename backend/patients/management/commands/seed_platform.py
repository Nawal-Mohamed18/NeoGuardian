from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from accounts.models import UserProfile

# Exactly three staff accounts — no demo patients.
STAFF_USERS = [
    ('admin', 'admin', 'System Administrator', 'Admin', ''),
    ('doctor', 'doctor', 'NICU Doctor', 'Doctor', 'NICU Pod A'),
    ('nurse', 'nurse', 'NICU Nurse', 'Nurse', 'NICU Pod A'),
]

LEGACY_USERNAMES = ('aisha', 'maria', 'sarah', 'liam')


class Command(BaseCommand):
    help = 'Create admin, doctor, and nurse accounts (password: password123). No patients.'

    def handle(self, *args, **options):
        keep = {u[0] for u in STAFF_USERS}
        User.objects.filter(username__in=LEGACY_USERNAMES).delete()
        extras = User.objects.exclude(username__in=keep).count()
        if extras:
            User.objects.exclude(username__in=keep).delete()

        created = 0
        for username, role, full_name, title, ward in STAFF_USERS:
            user, is_new = User.objects.get_or_create(
                username=username,
                defaults={'email': f'{username}@neoguardian.local'},
            )
            if is_new:
                created += 1
            user.set_password('password123')
            user.is_active = True
            user.save()
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    'role': role,
                    'full_name': full_name,
                    'title': title,
                    'ward': ward,
                    'wards': [ward] if ward else [],
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f'Staff ready: exactly 1 admin, 1 doctor, 1 nurse (password123). '
            f'{created} new, {extras} extra removed. Add patients via Admit Newborn.'
        ))
