from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile
from .roles import infer_role_from_username


@receiver(post_save, sender=User)
def ensure_profile_on_user_save(sender, instance: User, created: bool, **kwargs):
    """Every auth user must have a UserProfile (fixes bare createsuperuser / incomplete clones)."""
    if not created:
        # Still heal missing profiles on later saves (e.g. password reset of seeded users).
        if UserProfile.objects.filter(user_id=instance.pk).exists():
            return
    role = infer_role_from_username(instance.username)
    UserProfile.objects.get_or_create(
        user=instance,
        defaults={
            "role": role,
            "full_name": instance.get_full_name() or instance.username,
            "title": role.capitalize(),
            "ward": "NICU Pod A" if role in ("doctor", "nurse") else "",
            "wards": ["NICU Pod A"] if role in ("doctor", "nurse") else [],
        },
    )
