"""Smoke-test inference for the assessment model (local only)."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"


def predict_row(raw: dict) -> dict:
    cleaner = joblib.load(MODELS / "assessment_cleaner.joblib")
    scaler = joblib.load(MODELS / "assessment_scaler.joblib")
    model = joblib.load(MODELS / "assessment_balanced_rf.joblib")
    meta = joblib.load(MODELS / "assessment_train_meta.joblib")

    frame = pd.DataFrame([raw])
    if "WeightChangePct" not in frame.columns:
        raise KeyError("WeightChangePct required")

    cleaned = cleaner.transform(frame)
    names = list(cleaner.named_steps["cleaner"].get_feature_names_out())
    out = pd.DataFrame(cleaned, columns=names)
    scale_cols = [c for c in meta["scale_columns"] if c in out.columns]
    out[scale_cols] = scaler.transform(out[scale_cols])
    feats = meta["features"]
    proba = float(model.predict_proba(out[feats])[0][1])
    pct = round(proba * 100.0, 2)
    if pct > 30:
        tier = "High"
    elif pct > 15:
        tier = "Moderate"
    else:
        tier = "Low"
    return {"mortality_probability": pct, "mortality_tier": tier, "model": meta["model"]}


if __name__ == "__main__":
    sample = {
        "CurrentWeight": 3400.0,
        "WeightChangePct": -0.0286,
        "Temperature": 36.8,
        "HeartRate": 140,
        "RespiratoryRate": 45,
        "SpO2": 97,
        "BloodGlucose": 70,
        "SuspectedSepsis": "No",
        "RespiratoryDistressSyndrome": "Mild",
        "BirthAsphyxia": "None",
    }
    print(predict_row(sample))
