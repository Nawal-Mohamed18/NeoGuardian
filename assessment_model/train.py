"""
Train a Balanced Random Forest for assessment / reassess risk.

Uses only files inside assessment_model/.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from imblearn.ensemble import BalancedRandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent
SCALED_CSV = ROOT / "scaled" / "assessment_reassess_scaled.csv"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

MODEL_PATH = MODELS_DIR / "assessment_balanced_rf.joblib"
META_PATH = MODELS_DIR / "assessment_train_meta.joblib"
METRICS_JSON = REPORTS_DIR / "assessment_metrics.json"

TARGET_COL = "Outcome"
TEST_SIZE = 0.2
RANDOM_STATE = 42
DECISION_THRESHOLD = 0.50


def main() -> None:
    if not SCALED_CSV.exists():
        raise FileNotFoundError(f"Missing {SCALED_CSV}. Run preprocess.py first.")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(SCALED_CSV)
    y = df[TARGET_COL].astype(int)
    X = df.drop(columns=[TARGET_COL])
    features = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    model = BalancedRandomForestClassifier(
        n_estimators=400,
        max_depth=14,
        min_samples_leaf=3,
        sampling_strategy="all",
        replacement=True,
        bootstrap=False,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    y_pred = (proba >= DECISION_THRESHOLD).astype(int)

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, pos_label=1, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "positive_rate_test": float(y_test.mean()),
        "threshold": DECISION_THRESHOLD,
    }

    meta = {
        "model": "assessment_balanced_rf",
        "purpose": "reassess_bedside_risk",
        "threshold": DECISION_THRESHOLD,
        "features": features,
        "scale_columns": [
            "CurrentWeight",
            "WeightChangePct",
            "Temperature",
            "HeartRate",
            "RespiratoryRate",
            "SpO2",
            "BloodGlucose",
        ],
        "raw_columns": [
            "CurrentWeight",
            "WeightChangePct",
            "Temperature",
            "HeartRate",
            "RespiratoryRate",
            "SpO2",
            "BloodGlucose",
            "SuspectedSepsis",
            "RespiratoryDistressSyndrome",
            "BirthAsphyxia",
        ],
        "ui_asked_on_reassess": [
            "CurrentWeight",
            "Temperature",
            "HeartRate",
            "RespiratoryRate",
            "SpO2",
            "BloodGlucose",
            "SuspectedSepsis",
            "RespiratoryDistressSyndrome",
            "BirthAsphyxia",
        ],
        "admit_only_not_in_model": [
            "GestationalAge",
            "BirthWeight",
            "Sex",
            "DayOfLife",
            "RespiratorySupport",
            "FeedingDifficulty",
        ],
        "tier_bands_pct": {"Low": "<=15", "Moderate": "<=30", "High": ">30"},
        **{k: metrics[k] for k in ("accuracy", "precision", "recall", "f1_score", "roc_auc")},
        "n_features": len(features),
        "test_size": TEST_SIZE,
        "random_state": RANDOM_STATE,
    }

    joblib.dump(model, MODEL_PATH)
    joblib.dump(meta, META_PATH)
    METRICS_JSON.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(classification_report(y_test, y_pred, digits=3))
    print("Metrics:", json.dumps(metrics, indent=2))
    print(f"Model → {MODEL_PATH}")
    print(f"Meta  → {META_PATH}")
    print(f"Report→ {METRICS_JSON}")


if __name__ == "__main__":
    main()
