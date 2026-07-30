"""Map clinical assessment payloads → assessment_model raw feature row.

Admit-only fields (GA, birth weight, sex, day of life) are never model inputs.
Birth weight is read only to compute WeightChangePct.
"""

from __future__ import annotations

from typing import Any

GRADE_LEVELS = ("None", "Mild", "Moderate", "Severe")


def _yes_no(value: Any) -> str:
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("yes", "y", "true", "1"):
            return "Yes"
        if lowered in ("no", "n", "false", "0", ""):
            return "No"
    return "Yes" if bool(value) else "No"


def _grade(explicit: Any, flag: Any = None) -> str:
    if explicit is not None and str(explicit).strip() != "":
        text = str(explicit).strip().title()
        if text in GRADE_LEVELS:
            return text
        lowered = text.lower()
        if lowered in ("none", "no", "false", "0"):
            return "None"
        if lowered == "mild":
            return "Mild"
        if lowered == "moderate":
            return "Moderate"
        if lowered == "severe":
            return "Severe"
    return "Moderate" if bool(flag) else "None"


def _weight_grams(value: Any, *, fallback_kg: float) -> float:
    """Patient/API weights are kg; assessment model trains on grams."""
    if value is None or value == "":
        kg = float(fallback_kg)
    else:
        kg = float(value)
    if kg > 20:
        return float(kg)
    return float(kg) * 1000.0


def clinical_dict_to_assessment_row(data: dict, *, patient=None) -> dict:
    """Build raw row for assessment_cleaner.joblib (bedside/change features only)."""
    birth_kg = float(
        getattr(patient, "birth_weight", None)
        if patient is not None and getattr(patient, "birth_weight", None) is not None
        else data.get("birth_weight")
        or 2.5
    )
    current_raw = data.get("current_weight")
    if current_raw is None and patient is not None:
        current_raw = getattr(patient, "current_weight", None)
    if current_raw is None:
        current_raw = birth_kg

    birth_g = _weight_grams(birth_kg, fallback_kg=birth_kg)
    current_g = _weight_grams(current_raw, fallback_kg=birth_kg)
    weight_change_pct = (current_g - birth_g) / birth_g if birth_g else 0.0

    return {
        "CurrentWeight": round(float(current_g), 1),
        "WeightChangePct": round(float(weight_change_pct), 4),
        "Temperature": float(data["temperature"]) if data.get("temperature") is not None else 36.7,
        "HeartRate": float(data["heart_rate"]) if data.get("heart_rate") is not None else 140.0,
        "RespiratoryRate": float(data["respiratory_rate"])
        if data.get("respiratory_rate") is not None
        else 45.0,
        "SpO2": float(data["spo2"]) if data.get("spo2") is not None else 96.0,
        "BloodGlucose": float(data["blood_glucose"]) if data.get("blood_glucose") is not None else 70.0,
        "SuspectedSepsis": _yes_no(data.get("sepsis") or data.get("suspected_sepsis", False)),
        "RespiratoryDistressSyndrome": _grade(
            data.get("respiratory_distress_grade"),
            data.get("respiratory_distress_syndrome"),
        ),
        "BirthAsphyxia": _grade(
            data.get("birth_asphyxia_grade"),
            data.get("birth_asphyxia"),
        ),
    }
