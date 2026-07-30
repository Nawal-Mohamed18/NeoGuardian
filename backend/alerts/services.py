"""Keep clinical alerts aligned with live risk (same source as dashboard cards)."""

from __future__ import annotations

from assessments.risk_display import latest_assessment_payload
from patients.models import Patient

from .models import Alert

# Prefer bedside / complication drivers over soft demographic labels in alert copy.
_SOFT_FACTOR_HINTS = (
    "term infant",
    "within expected ranges",
    "bedside vitals and support within expected",
)


def _tier_alert_meta(tier: str) -> tuple[str, str] | None:
    if tier == "High":
        return "critical", "High Risk Newborn"
    if tier == "Moderate":
        return "warning", "Moderate Risk Newborn"
    if tier == "Low":
        return "info", "Low Risk Newborn"
    return None


def _driver_snippet(factors: list | None, *, limit: int = 3) -> str:
    cleaned = [str(f).strip() for f in (factors or []) if str(f).strip()]
    if not cleaned:
        return ""
    preferred = [
        f
        for f in cleaned
        if not any(h in f.lower() for h in _SOFT_FACTOR_HINTS)
    ]
    chosen = (preferred or cleaned)[:limit]
    return f" Drivers: {', '.join(chosen)}."


def build_alert_fields(patient: Patient, payload: dict) -> dict | None:
    tier = payload.get("mortality_tier") or "Low"
    meta = _tier_alert_meta(tier)
    if meta is None:
        return None
    severity, title = meta
    prob = float(payload.get("mortality_probability") or 0)
    window = payload.get("intervention_window") or ""
    drivers = _driver_snippet(payload.get("mortality_factors"))
    message = (
        f"Newborn {patient.patient_code}: clinical risk {tier} "
        f"({prob:.1f}% estimated 28-day risk). {window}.{drivers}"
    )
    return {
        "severity": severity,
        "title": title,
        "message": message,
    }


def upsert_risk_alert(patient: Patient, assessment, payload: dict | None = None):
    """Replace prior open alerts for this patient with one alert matching live risk."""
    Alert.objects.filter(patient=patient, acknowledged=False).update(acknowledged=True)

    payload = payload or latest_assessment_payload(assessment)
    if not payload:
        return None
    fields = build_alert_fields(patient, payload)
    if not fields:
        return None
    return Alert.objects.create(
        patient=patient,
        assessment=assessment,
        **fields,
    )


def sync_stale_risk_alerts(patient_ids) -> int:
    """
    1) Auto-resolve alerts that are not for the patient's latest assessment.
    2) Rewrite / replace the open alert so title, severity, and % match live risk
       (same latest_assessment_payload used by My Patients / dashboards).
    3) Resolve open alerts for discharged / inactive patients.
    """
    if not patient_ids:
        return 0

    resolved = 0
    patients = (
        Patient.objects.filter(id__in=patient_ids)
        .prefetch_related("assessments")
        .select_related("pod")
    )

    for patient in patients:
        latest = patient.assessments.first()
        open_qs = Alert.objects.filter(patient=patient, acknowledged=False)

        if patient.status != Patient.Status.ACTIVE or latest is None:
            resolved += open_qs.update(acknowledged=True)
            continue

        # Drop alerts tied to older assessments.
        stale = open_qs.exclude(assessment_id=latest.id)
        resolved += stale.update(acknowledged=True)

        payload = latest_assessment_payload(latest)
        fields = build_alert_fields(patient, payload)
        if not fields:
            resolved += open_qs.filter(acknowledged=False).update(acknowledged=True)
            continue

        current = (
            Alert.objects.filter(
                patient=patient,
                acknowledged=False,
                assessment_id=latest.id,
            )
            .order_by("-created_at", "-id")
            .first()
        )

        # Extra open rows for same assessment → keep one.
        if current:
            extras = Alert.objects.filter(
                patient=patient,
                acknowledged=False,
                assessment_id=latest.id,
            ).exclude(pk=current.pk)
            resolved += extras.update(acknowledged=True)

            needs_refresh = (
                current.severity != fields["severity"]
                or current.title != fields["title"]
                or current.message != fields["message"]
            )
            if needs_refresh:
                current.severity = fields["severity"]
                current.title = fields["title"]
                current.message = fields["message"]
                current.save(update_fields=["severity", "title", "message"])
        else:
            # Do NOT recreate alerts the clinician already acknowledged for this
            # assessment — that made "Mark as resolved" appear undone on refresh.
            already_logged = Alert.objects.filter(
                patient=patient,
                assessment_id=latest.id,
            ).exists()
            if not already_logged:
                Alert.objects.create(
                    patient=patient,
                    assessment=latest,
                    **fields,
                )

    return resolved
