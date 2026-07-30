"""Load synthetic BalancedRandomForest artifacts and run neonatal risk inference."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd
from django.conf import settings

from ai.model_features import clinical_dict_to_raw_model_row, extract_model_features_for_prediction
from ai.risk_engine import (
    INTERVENTION_WINDOWS,
    calculate_risk,
    normalize_tier,
    tier_from_probability,
)

logger = logging.getLogger(__name__)

MODEL_VERSION = "balanced_random_forest_synthetic_v3"


def _ml_dir() -> Path:
    return Path(getattr(settings, "ML_MODEL_DIR", settings.PROJECT_ROOT / "models"))


def _artifact_paths() -> tuple[Path, Path, Path, Path]:
    ml_dir = _ml_dir()
    return (
        ml_dir / getattr(settings, "ML_MODEL_FILE", "balanced_random_forest.joblib"),
        ml_dir / getattr(settings, "ML_CLEANER_FILE", "cleaner.joblib"),
        ml_dir / getattr(settings, "ML_SCALER_FILE", "scaler.joblib"),
        ml_dir / getattr(settings, "ML_TRAIN_META_FILE", "train_meta.joblib"),
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
        logger.warning("ML artifacts missing: %s", missing)
        return None
    signature = tuple(path.stat().st_mtime_ns for path in required)
    return _load_artifacts_for_signature(signature)


def model_status() -> dict:
    artifacts = _load_artifacts()
    if artifacts is None:
        return {
            "model_loaded": False,
            "model_path": None,
            "model_version": "clinical-rules-v2",
        }
    _, _, _, _, model_path, model_version = artifacts
    return {
        "model_loaded": True,
        "model_path": str(model_path),
        "model_version": model_version,
    }


def _transform_for_model(data: dict, cleaner, scaler, meta: dict) -> pd.DataFrame:
    raw = clinical_dict_to_raw_model_row(data)
    frame = pd.DataFrame([raw])
    transformed = cleaner.transform(frame)
    names = [str(n).split("__", 1)[-1] for n in cleaner.get_feature_names_out()]
    out = pd.DataFrame(transformed, columns=names)

    # Birth-weight categories use unscaled grams.
    bw = out["BirthWeight"].astype(float)
    out["BW_ELBW"] = (bw < 1000).astype(int)
    out["BW_VLBW"] = ((bw >= 1000) & (bw < 1500)).astype(int)
    out["BW_LBW"] = ((bw >= 1500) & (bw < 2500)).astype(int)
    out["BW_NBW"] = (bw >= 2500).astype(int)

    scale_cols = [c for c in meta.get("scale_columns", []) if c in out.columns]
    if scale_cols:
        out[scale_cols] = scaler.transform(out[scale_cols])

    features = list(meta["features"])
    missing = [f for f in features if f not in out.columns]
    if missing:
        raise KeyError(f"Model features missing after transform: {missing}")
    return out[features]


def predict_risk(data: dict) -> Optional[dict]:
    """
    Run balanced_random_forest.joblib with cleaner + scaler.
    Probability comes from predict_proba (model). Tier is derived from that %:
    ≤15 Low, ≤30 Moderate, >30 High. train_meta.threshold (0.65) is training
    binary-cutoff only — not used for Low/Moderate/High display bands.
    Clinical rules contribute explanatory factor labels only.
    """
    artifacts = _load_artifacts()
    if artifacts is None:
        return None

    model, cleaner, scaler, meta, _, model_version = artifacts
    filtered = extract_model_features_for_prediction(data)
    if filtered.get("blood_glucose") is None or filtered.get("blood_glucose") == "":
        return None

    try:
        row = _transform_for_model(filtered, cleaner, scaler, meta)
        if hasattr(model, "predict_proba"):
            proba = float(model.predict_proba(row)[0][1])
        else:
            proba = float(model.predict(row)[0])
            if proba > 1:
                proba = proba / 100.0
    except Exception:
        logger.exception("ML prediction failed")
        return None

    rules = calculate_risk(data)
    factors = list(rules["risk_factors"])
    from ai.fallback import round_risk_pct

    prob_pct = round_risk_pct(max(0.0, min(proba * 100.0, 99.0)))
    tier = normalize_tier(tier_from_probability(prob_pct))

    return {
        "mortality_probability": prob_pct,
        "mortality_tier": tier,
        "mortality_factors": factors,
        "model_confidence": min(
            0.95,
            0.7
            + 0.05
            * sum(
                1
                for k in ("temperature", "heart_rate", "spo2", "respiratory_rate", "blood_glucose")
                if data.get(k) is not None
            ),
        ),
        "intervention_window": INTERVENTION_WINDOWS[tier],
        "model_source": model_version,
    }
