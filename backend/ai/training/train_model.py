"""Validate neonatal training data and build NeoGuardian ML artifacts.

This pipeline is suitable for prototype evaluation with synthetic data. It is
not a clinically validated mortality model. Replace the CSV with governed,
de-identified outcome data and complete external validation before clinical use.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


FEATURE_COLUMNS = [
    "MotherAge",
    "AntenatalVisits",
    "GestationalAge_weeks",
    "BirthWeight_g",
    "Apgar1",
    "Apgar5",
    "Temperature_C",
    "HeartRate",
    "RespiratoryRate",
    "SpO2",
    "BloodGlucose_mg_dL",
    "MaternalHypertension",
    "MaternalDiabetes",
    "DeliveryMode",
    "MultipleBirth",
    "Sex",
    "Sepsis",
    "RespiratoryDistressSyndrome",
    "BirthAsphyxia",
    "WeightPerWeek",
    "VitalRiskScore",
]
TARGET_COLUMN = "Died"

SCALE_COLUMNS = [
    "MotherAge",
    "AntenatalVisits",
    "GestationalAge_weeks",
    "BirthWeight_g",
    "Apgar1",
    "Apgar5",
    "Temperature_C",
    "HeartRate",
    "RespiratoryRate",
    "SpO2",
    "BloodGlucose_mg_dL",
    "WeightPerWeek",
    "VitalRiskScore",
]

BINARY_COLUMNS = [
    "MaternalHypertension",
    "MaternalDiabetes",
    "DeliveryMode",
    "MultipleBirth",
    "Sex",
    "Sepsis",
    "RespiratoryDistressSyndrome",
    "BirthAsphyxia",
    TARGET_COLUMN,
]

RANGES = {
    "MotherAge": (12, 60),
    "AntenatalVisits": (0, 30),
    "GestationalAge_weeks": (22, 44),
    "BirthWeight_g": (300, 6000),
    "Apgar1": (0, 10),
    "Apgar5": (0, 10),
    "Temperature_C": (30, 43),
    "HeartRate": (40, 260),
    "RespiratoryRate": (0, 150),
    "SpO2": (0, 100),
    "BloodGlucose_mg_dL": (0, 500),
}


def validate_dataset(data: pd.DataFrame) -> None:
    expected = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing = [column for column in expected if column not in data.columns]
    extra = [column for column in data.columns if column not in expected]
    if missing or extra:
        raise ValueError(f"Dataset schema mismatch. Missing={missing}; extra={extra}")
    if data.empty:
        raise ValueError("Dataset is empty.")
    if data[expected].isnull().any().any():
        nulls = data[expected].isnull().sum()
        raise ValueError(f"Missing values are not allowed:\n{nulls[nulls > 0]}")

    for column in expected:
        if not pd.api.types.is_numeric_dtype(data[column]):
            raise ValueError(f"{column} must be numeric.")

    for column in BINARY_COLUMNS:
        values = set(data[column].unique())
        if not values.issubset({0, 1}):
            raise ValueError(f"{column} must contain only 0/1; found {sorted(values)}")

    for column, (minimum, maximum) in RANGES.items():
        invalid = ~data[column].between(minimum, maximum)
        if invalid.any():
            raise ValueError(
                f"{column} has {int(invalid.sum())} values outside {minimum}..{maximum}."
            )

    expected_weight_per_week = data["BirthWeight_g"] / data["GestationalAge_weeks"]
    if not np.allclose(data["WeightPerWeek"], expected_weight_per_week, atol=0.02):
        raise ValueError("WeightPerWeek must equal BirthWeight_g / GestationalAge_weeks.")

    expected_vital_score = data["Apgar5"] + data["SpO2"] - data["RespiratoryRate"]
    if not np.allclose(data["VitalRiskScore"], expected_vital_score, atol=0.02):
        raise ValueError("VitalRiskScore must equal Apgar5 + SpO2 - RespiratoryRate.")

    positive_count = int(data[TARGET_COLUMN].sum())
    if positive_count < 50 or positive_count == len(data):
        raise ValueError(
            f"Target needs enough examples of both outcomes; found {positive_count} deaths "
            f"in {len(data)} rows."
        )


def _tier(probability: float) -> str:
    if probability >= 0.15:
        return "High"
    if probability >= 0.08:
        return "Moderate"
    return "Low"


def _atomic_joblib_dump(value, destination: Path) -> None:
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    joblib.dump(value, temporary)
    temporary.replace(destination)


def train(data_path: Path, output_dir: Path, random_state: int = 42) -> dict:
    data = pd.read_csv(data_path)
    validate_dataset(data)

    X = data[FEATURE_COLUMNS].astype(float)
    y = data[TARGET_COLUMN].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=random_state,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()
    X_train_scaled[SCALE_COLUMNS] = scaler.fit_transform(X_train[SCALE_COLUMNS])
    X_test_scaled[SCALE_COLUMNS] = scaler.transform(X_test[SCALE_COLUMNS])

    base_model = RandomForestClassifier(
        n_estimators=400,
        max_depth=None,
        min_samples_leaf=4,
        max_features="sqrt",
        class_weight="balanced_subsample",
        random_state=random_state,
        n_jobs=-1,
    )
    model = CalibratedClassifierCV(base_model, method="sigmoid", cv=5)
    model.fit(X_train_scaled, y_train)

    probabilities = model.predict_proba(X_test_scaled)[:, 1]
    predictions = (probabilities >= 0.15).astype(int)
    tiers = pd.Series([_tier(probability) for probability in probabilities])

    metrics = {
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "average_precision": round(float(average_precision_score(y_test, probabilities)), 4),
        "brier_score": round(float(brier_score_loss(y_test, probabilities)), 4),
        "mortality_prevalence": round(float(y.mean()), 4),
        "test_rows": int(len(y_test)),
        "confusion_matrix_at_15_percent": confusion_matrix(y_test, predictions).tolist(),
        "classification_report_at_15_percent": classification_report(
            y_test,
            predictions,
            output_dict=True,
            zero_division=0,
        ),
        "tier_distribution": {
            str(key): int(value) for key, value in tiers.value_counts().to_dict().items()
        },
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    _atomic_joblib_dump(model, output_dir / "random_forest_model.joblib")
    _atomic_joblib_dump(scaler, output_dir / "neonatal_scaler.pkl")
    _atomic_joblib_dump(SCALE_COLUMNS, output_dir / "scale_cols.joblib")
    (output_dir / "train_columns.json").write_text(
        json.dumps(FEATURE_COLUMNS, indent=2),
        encoding="utf-8",
    )

    metadata = {
        "model_version": "calibrated_random_forest_synthetic_v2",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_data": str(data_path),
        "training_rows": int(len(data)),
        "target": TARGET_COLUMN,
        "feature_columns": FEATURE_COLUMNS,
        "scale_columns": SCALE_COLUMNS,
        "random_state": random_state,
        "scikit_learn_version": sklearn.__version__,
        "synthetic_data": True,
        "clinical_use": False,
        "limitations": (
            "Trained on synthetic outcomes. Metrics measure agreement with the synthetic "
            "generator, not real-world neonatal mortality performance."
        ),
        "metrics": metrics,
    }
    (output_dir / "model_metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    return metadata


def main() -> None:
    project_root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        type=Path,
        default=project_root / "models" / "neonatal_training.csv",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=project_root / "models",
    )
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    metadata = train(args.data.resolve(), args.output.resolve(), args.random_state)
    print(json.dumps(metadata["metrics"], indent=2))
    print(f"\nArtifacts written to: {args.output.resolve()}")
    print("WARNING: synthetic prototype model; not clinically validated.")


if __name__ == "__main__":
    main()
