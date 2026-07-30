"""Scope clinical data by role and assigned POD(s)."""

from __future__ import annotations


def get_profile(user):
    return getattr(user, "profile", None)


def assigned_pod_names_for_user(user) -> list[str]:
    profile = get_profile(user)
    if profile is None:
        return []
    if hasattr(profile, "assigned_pod_names"):
        return profile.assigned_pod_names()
    ward = (getattr(profile, "ward", "") or "").strip()
    return [ward] if ward else []


def filter_patients_for_user(qs, user):
    profile = get_profile(user)
    if profile is None:
        return qs.none()
    if profile.role == "admin":
        return qs
    if profile.role in ("doctor", "nurse"):
        wards = assigned_pod_names_for_user(user)
        if not wards:
            return qs.none()
        # Clinical staff only see active patients in their assigned POD(s)
        return qs.filter(status="active", pod__name__in=wards)
    return qs


def filter_alerts_for_user(qs, user):
    from patients.models import Patient

    patient_ids = filter_patients_for_user(Patient.objects.all(), user).values_list("id", flat=True)
    return qs.filter(patient_id__in=patient_ids)


def normalize_risk_tier(tier: str) -> str:
    t = (tier or "Low").strip()
    if t in ("High", "Critical"):
        return "high"
    if t in ("Moderate", "Medium"):
        return "medium"
    return "low"
