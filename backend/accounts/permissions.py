from rest_framework import permissions
from rest_framework.permissions import IsAuthenticatedOrReadOnly  # re-exported for settings


def get_user_profile(user):
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    try:
        return user.profile
    except Exception:
        return None


class IsAdmin(permissions.BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        profile = get_user_profile(request.user)
        return bool(profile and profile.role == "admin")


class IsDoctorOrReadOnly(permissions.BasePermission):
    """Doctors and nurses may create assessments; authenticated users may read."""

    message = "Only doctors and nurses can create or update assessments."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        profile = get_user_profile(request.user)
        return bool(profile and profile.role in ("doctor", "nurse"))


class IsDoctor(permissions.BasePermission):
    message = "Only doctors can perform this action."

    def has_permission(self, request, view):
        profile = get_user_profile(request.user)
        return bool(profile and profile.role == "doctor")


class IsNurseOrDoctor(permissions.BasePermission):
    """Nurses and doctors may admit/update patients."""

    message = "Only nurses and doctors can admit or update patients."

    def has_permission(self, request, view):
        profile = get_user_profile(request.user)
        return bool(profile and profile.role in ("nurse", "doctor"))


class IsStaffUser(permissions.BasePermission):
    """Any authenticated hospital role: admin, doctor, or nurse."""

    message = "Authentication required."

    def has_permission(self, request, view):
        profile = get_user_profile(request.user)
        return bool(profile and profile.role in ("admin", "doctor", "nurse"))
