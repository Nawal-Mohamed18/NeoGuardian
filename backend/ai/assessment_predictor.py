"""Load assessment_model Balanced RF and run reassess risk inference."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd
from django.conf import settings

from ai.assessment_features import clinical_dict_to_assessment_row
from ai.fallback import round_risk_pct
from ai.risk_engine import (
    INTERVENTION_WINDOWS,
    calculate_risk,
    normalize_tier,
    tier_from_probability,
)

logger = logging.getLogger(__name__)

MODEL_VERSION = "assessment_balanced_rf"


def _ml_dir() -> Path:
    return Path(
        getattr(
            settings,
            "ASSESS_ML_MODEL_DIR",
            settings.PROJECT_ROOT / "assessment_model" / "models",
        )
    )


def _artifact_paths() -> tuple[Path, Path, Path, Path]:
    ml_dir = _ml_dir()
    return (
        ml_dir / getattr(settings, "ASSESS_ML_MODEL_FILE", "assessment_balanced_rf.joblib"),
        ml_dir / getattr(settings, "ASSESS_ML_CLEANER_FILE", "assessment_cleaner.joblib"),
        ml_dir / getattr(settings, "ASSESS_ML_SCALER_FILE", "assessment_scaler.joblib"),
        ml_dir / getattr(settings, "ASSESS_ML_TRAIN_META_FILE", "assessment_train_meta.joblib"),
    )


@lru_cache(maxsize=2)
def _load_artifacts_for_signature(
    signature: tuple[int, ...],
) -> tuple[Any, Any, Any, dict, Path, str]:
    del signature
    model_path, cleaner_path, scaler_path, meta_path = _artifact_paths()
    model = joblib.load(model_path)
    cleaner = joblib.load(cleaner_path)
    scaler = joblib.load(scaler_path)
    meta = joblib.load(meta_path)
    version = str(meta.get("model") or MODEL_VERSION)
    return model, cleaner, scaler, meta, model_path, version


def _load_artifacts() -> Optional[tuple[Any, Any, Any, dict, Path, str]]:
    model_path, cleaner_path, scaler_path, meta_path = _artifact_paths()
    required = (model_path, cleaner_path, scaler_path, meta_path)
    if not all(p.exists() for p in required):
        missing = [str(p) for p in required if not p.exists()]
        logger.warning("Assessment ML artifacts missing: %s", missing)
        return None
    signature = tuple(path.stat().st_mtime_ns for path in required)
    return _load_artifacts_for_signature(signature)


def assessment_model_status() -> dict:
    artifacts = _load_artifacts()
    if artifacts is None:
        return {
            "assessment_model_loaded": False,
            "assessment_model_path": None,
            "assessment_model_version": None,
        }
    _, _, _, _, model_path, model_version = artifacts
    return {
        "assessment_model_loaded": True,
        "assessment_model_path": str(model_path),
        "assessment_model_version": model_version,
    }


def _transform(raw: dict, cleaner, scaler, meta: dict) -> pd.DataFrame:
    frame = pd.DataFrame([raw])
    cleaned = cleaner.transform(frame)
    names = list(cleaner.named_steps["cleaner"].get_feature_names_out())
    out = pd.DataFrame(cleaned, columns=names)
    scale_cols = [c for c in meta.get("scale_columns", []) if c in out.columns]
    if scale_cols:
        out[scale_cols] = scaler.transform(out[scale_cols])
    features = list(meta["features"])
    missing = [f for f in features if f not in out.columns]
    if missing:
        raise KeyError(f"Assessment model features missing: {missing}")
    return out[features]


def predict_assessment_risk(data: dict, *, patient=None) -> Optional[dict]:
    """
    Run assessment_balanced_rf for reassess / assess API.

    Probability from predict_proba; tier bands ≤15 Low, ≤30 Moderate, >30 High.
    """
    artifacts = _load_artifacts()
    if artifacts is None:
        return None

    model, cleaner, scaler, meta, _, model_version = artifacts
    if data.get("blood_glucose") is None or data.get("blood_glucose") == "":
        return None

    try:
        raw = clinical_dict_to_assessment_row(data, patient=patient)
        row = _transform(raw, cleaner, scaler, meta)
        if hasattr(model, "predict_proba"):
            proba = float(model.predict_proba(row)[0][1])
        else:
            proba = float(model.predict(row)[0])
            if proba > 1:
                proba = proba / 100.0
    except Exception:
        logger.exception("Assessment ML prediction failed")
        return None

    # Care-note drivers from bedside/change signals only (no admit demographics).
    rules_input = {
        "gestational_age": 40,  # placeholder so demographic rules stay Low/neutral
        "birth_weight": 3.5,
        "mother_age": 28,
        "gender": "Female",
        "sepsis": raw["SuspectedSepsis"] == "Yes",
        "respiratory_distress_syndrome": raw["RespiratoryDistressSyndrome"] != "None",
        "birth_asphyxia": raw["BirthAsphyxia"] != "None",
        "feeding_difficulty": False,
        "respiratory_support": "none",
        "temperature": raw["Temperature"],
        "heart_rate": raw["HeartRate"],
        "spo2": raw["SpO2"],
        "respiratory_rate": raw["RespiratoryRate"],
        "blood_glucose": raw["BloodGlucose"],
        "current_weight": raw["CurrentWeight"] / 1000.0,
    }
    rules = calculate_risk(rules_input)
    factors = [
        f
        for f in rules["risk_factors"]
        if not any(
            tip in f.lower()
            for tip in (
                "birth weight",
                "gestational age",
                "term infant",
                "maternal age",
                "demographics",
            )
        )
    ]
    if raw["WeightChangePct"] <= -0.08:
        factors.insert(
            0,
            f"Weight change {raw['WeightChangePct'] * 100:.1f}% since birth",
        )
    current_kg = raw["CurrentWeight"] / 1000.0
    if current_kg < 1.5:
        factors.insert(0, f"Current weight <1.5 kg ({current_kg:.1f} kg)")
    elif current_kg < 2.5:
        factors.insert(0, f"Current weight 1.5–2.49 kg ({current_kg:.1f} kg)")

    seen: set[str] = set()
    unique_factors: list[str] = []
    for f in factors:
        if f not in seen:
            seen.add(f)
            unique_factors.append(f)

    prob_pct = round_risk_pct(max(0.0, min(proba * 100.0, 99.0)))
    tier = normalize_tier(tier_from_probability(prob_pct))

    return {
        "mortality_probability": prob_pct,
        "mortality_tier": tier,
        "mortality_factors": unique_factors,
        "model_confidence": min(
            0.95,
            0.72
            + 0.04
            * sum(
                1
                for k in ("temperature", "heart_rate", "spo2", "respiratory_rate", "blood_glucose", "current_weight")
                if data.get(k) is not None
            ),
        ),
        "intervention_window": INTERVENTION_WINDOWS[tier],
        "model_source": model_version,
    }
