"""Separate registration persistence from synthetic ML model features.

Registration/admin fields (name, MRN, POD, bed, gravida, parity, etc.) must never
enter the classifier. Only the clinical feature subset defined by train_meta.joblib
is used for prediction.
"""

from __future__ import annotations

from typing import Any

# Keys allowed into prediction (API/clinical dict form — not registration).
MODEL_FEATURE_KEYS = frozenset(
    {
        "mother_age",
        "antenatal_visits",
        "anc_visits",
        "maternal_hypertension",
        "hypertension",
        "maternal_diabetes",
        "gestational_diabetes",
        "prolonged_rupture_of_membranes",
        "gender",
        "birth_weight",
        "gestational_age",
        "delivery_type",
        "delivery_vaginal",
        "multiple_birth",
        "apgar_1min",
        "apgar_5min",
        "apgar_1min_components",
        "apgar_5min_components",
        "temperature",
        "heart_rate",
        "spo2",
        "respiratory_rate",
        "blood_glucose",
        "sepsis",
        "suspected_sepsis",
        "respiratory_distress_syndrome",
        "respiratory_distress_grade",
        "birth_asphyxia",
        "birth_asphyxia_grade",
        "current_weight",
    }
)

REGISTRATION_ONLY_KEYS = frozenset(
    {
        "hospital_mrn",
        "mother_name",
        "display_name",
        "pod_id",
        "bed_number",
        "blood_group",
        "hiv_status",
        "gravida",
        "parity",
        "patient_code",
        "status",
        "admitted_by",
    }
)

DELIVERY_LABELS = {
    "normal_vaginal": "Normal Vaginal Delivery",
    "emergency_csection": "Emergency C-section",
    "elective_csection": "Elective C-section",
    "assisted_forceps": "Assisted forceps",
    "Normal Vaginal Delivery": "Normal Vaginal Delivery",
    "Emergency C-section": "Emergency C-section",
    "Elective C-section": "Elective C-section",
    "Assisted forceps": "Assisted forceps",
}

SEVERITY_LEVELS = ("None", "Mild", "Moderate", "Severe")


def extract_model_features_for_prediction(data: dict) -> dict:
    """Strip registration/admin keys before risk/ML."""
    return {k: v for k, v in data.items() if k in MODEL_FEATURE_KEYS}


def _yes_no(value: Any) -> str:
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("yes", "y", "true", "1"):
            return "Yes"
        if v in ("no", "n", "false", "0", ""):
            return "No"
    return "Yes" if bool(value) else "No"


def _severity(value: Any, fallback_bool: Any = None) -> str:
    if isinstance(value, str) and value.strip() in SEVERITY_LEVELS:
        return value.strip()
    if value is None and fallback_bool is not None:
        return "Moderate" if bool(fallback_bool) else "None"
    if isinstance(value, bool):
        return "Moderate" if value else "None"
    return "None"


def _sex(gender: Any) -> str:
    g = str(gender or "").strip().lower()
    if g.startswith("m"):
        return "Male"
    return "Female"


def _apgar_component(components: Any, key: str, default: int = 2) -> int:
    if not isinstance(components, dict):
        return default
    raw = components.get(key)
    if raw is None:
        return default
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return default
    return max(0, min(2, n))


def build_model_features_from_admit(patient, clinical_snapshot: dict) -> dict:
    """
    Build clinical assessment dict from saved patient + admit vitals snapshot.
    Does not include registration fields (name/MRN/POD/bed/gravida/parity).
    """
    maternal = getattr(patient, "maternal", None)
    snap = clinical_snapshot or {}
    return {
        "mother_age": patient.mother_age,
        "antenatal_visits": getattr(maternal, "anc_visits", 0) if maternal else 0,
        "maternal_hypertension": bool(getattr(maternal, "hypertension", False)) if maternal else False,
        "maternal_diabetes": bool(getattr(maternal, "gestational_diabetes", False)) if maternal else False,
        "prolonged_rupture_of_membranes": bool(snap.get("prolonged_rupture_of_membranes", False)),
        "gender": patient.gender,
        "birth_weight": float(patient.birth_weight),
        "gestational_age": float(patient.gestational_age),
        "delivery_type": getattr(patient, "delivery_type", "") or "",
        "multiple_birth": bool(snap.get("multiple_birth", False)),
        "apgar_1min": patient.apgar_1min,
        "apgar_5min": patient.apgar_5min,
        "apgar_1min_components": snap.get("apgar_1min_components") or patient.apgar_1min_components,
        "apgar_5min_components": snap.get("apgar_5min_components") or patient.apgar_5min_components,
        "temperature": snap.get("temperature"),
        "heart_rate": snap.get("heart_rate"),
        "spo2": snap.get("spo2"),
        "respiratory_rate": snap.get("respiratory_rate"),
        "blood_glucose": snap.get("blood_glucose"),
        "sepsis": bool(snap.get("sepsis", False)),
        "respiratory_distress_grade": _severity(
            snap.get("respiratory_distress_grade"),
            snap.get("respiratory_distress_syndrome"),
        ),
        "birth_asphyxia_grade": _severity(
            snap.get("birth_asphyxia_grade"),
            snap.get("birth_asphyxia"),
        ),
        # DB-friendly booleans derived from grades
        "respiratory_distress_syndrome": _severity(
            snap.get("respiratory_distress_grade"),
            snap.get("respiratory_distress_syndrome"),
        )
        != "None",
        "birth_asphyxia": _severity(
            snap.get("birth_asphyxia_grade"),
            snap.get("birth_asphyxia"),
        )
        != "None",
        "current_weight": snap.get("current_weight", patient.current_weight or patient.birth_weight),
        "respiratory_support": snap.get("respiratory_support", "none"),
        "feeding_difficulty": bool(snap.get("feeding_difficulty", False)),
    }


def clinical_dict_to_raw_model_row(data: dict) -> dict:
    """Map clinical API dict → raw columns expected by models/cleaner.joblib."""
    a1 = data.get("apgar_1min_components") or {}
    a5 = data.get("apgar_5min_components") or {}
    delivery = DELIVERY_LABELS.get(str(data.get("delivery_type") or ""), "Normal Vaginal Delivery")
    # Admit RF always uses birth weight (kg → g). Current weight belongs to the reassess model.
    weight_kg = data.get("birth_weight")
    if weight_kg is None:
        weight_kg = 2.5
    birth_weight_g = float(weight_kg) * 1000.0

    anc = data.get("antenatal_visits")
    if anc is None:
        anc = data.get("anc_visits", 0)

    return {
        "BirthAsphyxia": _severity(data.get("birth_asphyxia_grade"), data.get("birth_asphyxia")),
        "RespiratoryDistressSyndrome": _severity(
            data.get("respiratory_distress_grade"),
            data.get("respiratory_distress_syndrome"),
        ),
        "MultipleBirth": _yes_no(data.get("multiple_birth")),
        "MaternalHypertension": _yes_no(
            data.get("maternal_hypertension", data.get("hypertension"))
        ),
        "GestationalDiabetes": _yes_no(
            data.get("maternal_diabetes", data.get("gestational_diabetes"))
        ),
        "ProlongedRuptureOfMembranes": _yes_no(data.get("prolonged_rupture_of_membranes")),
        "SuspectedSepsis": _yes_no(data.get("suspected_sepsis", data.get("sepsis"))),
        "Sex": _sex(data.get("gender")),
        "DeliveryMode": delivery,
        "MotherAge": float(data.get("mother_age") or 28),
        "AntenatalVisits": float(anc or 0),
        "GestationalAge": float(data.get("gestational_age") or 37),
        "BirthWeight": birth_weight_g,
        "Temperature": float(data["temperature"]) if data.get("temperature") is not None else 36.8,
        "HeartRate": float(data["heart_rate"]) if data.get("heart_rate") is not None else 140.0,
        "RespiratoryRate": float(data["respiratory_rate"])
        if data.get("respiratory_rate") is not None
        else 45.0,
        "SpO₂": float(data["spo2"]) if data.get("spo2") is not None else 97.0,
        "BloodGlucose": float(data["blood_glucose"])
        if data.get("blood_glucose") is not None
        else 70.0,
        "Appearance1": _apgar_component(a1, "appearance"),
        "Pulse1": _apgar_component(a1, "pulse"),
        "Grimace1": _apgar_component(a1, "grimace"),
        "Activity1": _apgar_component(a1, "activity"),
        "Respiration1": _apgar_component(a1, "respiration"),
        "Appearance5": _apgar_component(a5, "appearance"),
        "Pulse5": _apgar_component(a5, "pulse"),
        "Grimace5": _apgar_component(a5, "grimace"),
        "Activity5": _apgar_component(a5, "activity"),
        "Respiration5": _apgar_component(a5, "respiration"),
    }
