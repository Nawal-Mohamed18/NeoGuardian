from django.core.exceptions import ValidationError


def occupied_beds(pod) -> int:
    from patients.models import Patient
    return Patient.objects.filter(pod=pod, status="active").count()


def ensure_bed_available(pod):
    used = occupied_beds(pod)
    if used >= pod.bed_capacity:
        raise ValidationError(
            f"Pod '{pod.name}' is at capacity ({used}/{pod.bed_capacity} beds occupied)."
        )


def normalize_bed_number(value: str | None) -> str:
    return (value or "").strip().upper()


def ensure_bed_number_unique(pod, bed_number: str, *, exclude_patient_id: int | None = None):
    """Active patients in the same POD cannot share a bed label."""
    from patients.models import Patient

    bed = normalize_bed_number(bed_number)
    if not bed or pod is None:
        return bed

    qs = Patient.objects.filter(pod=pod, status="active").exclude(bed_number="")
    # Case/space-insensitive match against normalized value
    matches = []
    for p in qs.only("id", "bed_number", "patient_code"):
        if exclude_patient_id and p.id == exclude_patient_id:
            continue
        if normalize_bed_number(p.bed_number) == bed:
            matches.append(p)
    if matches:
        other = matches[0].patient_code
        raise ValidationError(
            f"Bed '{bed}' is already assigned to {other} in {pod.name}. Choose a different bed."
        )
    return bed
