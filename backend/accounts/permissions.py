from rest_framework import permissions
from rest_framework.permissions import IsAuthenticatedOrReadOnly  # re-exported for settings

from .models import UserProfile
from .roles import canonical_role, infer_role_from_username


def get_user_profile(user):
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    pk = getattr(user, "pk", None)
    if not pk:
        return None
    # Always hit the DB — avoid stale reverse-OneToOne cache after deletes/clones.
    return UserProfile.objects.filter(user_id=pk).first()


def ensure_user_profile(user):
    """Return a profile, creating a sensible default if the clone/DB is missing one."""
    profile = get_user_profile(user)
    if profile is not None:
        role = canonical_role(profile.role)
        if role and role != profile.role:
            profile.role = role
            profile.save(update_fields=["role"])
        return profile

    if user is None or not getattr(user, "is_authenticated", False) or not getattr(user, "pk", None):
        return None

    role = infer_role_from_username(getattr(user, "username", ""))
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "role": role,
            "full_name": user.get_full_name() or user.username,
            "title": role.capitalize(),
            "ward": "NICU Pod A" if role in ("doctor", "nurse") else "",
            "wards": ["NICU Pod A"] if role in ("doctor", "nurse") else [],
        },
    )
    # If an empty/legacy row already existed with a bad role, normalize it.
    fixed = canonical_role(profile.role) or role
    if profile.role != fixed:
        profile.role = fixed
        profile.save(update_fields=["role"])
    return profile


def _role_of(user) -> str | None:
    profile = ensure_user_profile(user)
    if not profile:
        return None
    return canonical_role(profile.role)


class IsAdmin(permissions.BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        return _role_of(request.user) == "admin"


class IsDoctorOrReadOnly(permissions.BasePermission):
    """Doctors and nurses may create assessments; authenticated users may read."""

    message = "Only doctors and nurses can create or update assessments."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return _role_of(request.user) in ("doctor", "nurse")


class IsDoctor(permissions.BasePermission):
    message = "Only doctors can perform this action."

    def has_permission(self, request, view):
        return _role_of(request.user) == "doctor"


class IsNurseOrDoctor(permissions.BasePermission):
    """Nurses and doctors may admit/update patients."""

    message = "Only nurses and doctors can admit or update patients."

    def has_permission(self, request, view):
        return _role_of(request.user) in ("nurse", "doctor")


class IsStaffUser(permissions.BasePermission):
    """Any authenticated hospital role: admin, doctor, or nurse."""

    message = "Authentication required."

    def has_permission(self, request, view):
        return _role_of(request.user) in ("admin", "doctor", "nurse")
