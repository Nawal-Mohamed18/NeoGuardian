"""
Clean + scale the assessment reassess dataset.

All artifacts stay inside assessment_model/.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "dataset"
SCALED_DIR = ROOT / "scaled"
MODELS_DIR = ROOT / "models"

RAW_CSV = DATASET_DIR / "assessment_reassess_raw.csv"
CLEAN_CSV = DATASET_DIR / "assessment_reassess_clean.csv"
SCALED_CSV = SCALED_DIR / "assessment_reassess_scaled.csv"
CLEANER_PATH = MODELS_DIR / "assessment_cleaner.joblib"
SCALER_PATH = MODELS_DIR / "assessment_scaler.joblib"

TARGET_COL = "Outcome"

ORDINAL_FEATURES: dict[str, list[str]] = {
    "RespiratoryDistressSyndrome": ["None", "Mild", "Moderate", "Severe"],
    "BirthAsphyxia": ["None", "Mild", "Moderate", "Severe"],
}

BINARY_FEATURES = [
    "SuspectedSepsis",
]

NUMERIC_FEATURES = [
    "CurrentWeight",
    "WeightChangePct",
    "Temperature",
    "HeartRate",
    "RespiratoryRate",
    "SpO2",
    "BloodGlucose",
]


def build_cleaner() -> ColumnTransformer:
    ordinal_cols = list(ORDINAL_FEATURES.keys())
    ordinal_cats = [ORDINAL_FEATURES[c] for c in ordinal_cols]
    transformers = [
        (
            "ord",
            OrdinalEncoder(
                categories=ordinal_cats,
                handle_unknown="use_encoded_value",
                unknown_value=-1,
            ),
            ordinal_cols,
        ),
        (
            "bin",
            OrdinalEncoder(
                categories=[["No", "Yes"] for _ in BINARY_FEATURES],
                handle_unknown="use_encoded_value",
                unknown_value=-1,
            ),
            BINARY_FEATURES,
        ),
        ("num", "passthrough", NUMERIC_FEATURES),
    ]
    return ColumnTransformer(transformers, remainder="drop", verbose_feature_names_out=False)


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, Pipeline]:
    y = df[TARGET_COL].astype(int)
    feature_df = df.drop(columns=[TARGET_COL])
    cleaner = Pipeline([("cleaner", build_cleaner())])
    transformed = cleaner.fit_transform(feature_df)
    names = list(cleaner.named_steps["cleaner"].get_feature_names_out())
    out = pd.DataFrame(transformed, columns=names)
    out[TARGET_COL] = y.values
    return out, cleaner


def scale(clean_df: pd.DataFrame) -> tuple[pd.DataFrame, StandardScaler, list[str]]:
    y = clean_df[TARGET_COL]
    X = clean_df.drop(columns=[TARGET_COL])
    scale_cols = [c for c in NUMERIC_FEATURES if c in X.columns]
    scaler = StandardScaler()
    X_scaled = X.copy()
    X_scaled[scale_cols] = scaler.fit_transform(X[scale_cols])
    out = X_scaled.copy()
    out[TARGET_COL] = y.values
    return out, scaler, scale_cols


def main() -> None:
    if not RAW_CSV.exists():
        raise FileNotFoundError(f"Missing {RAW_CSV}. Run generate_dataset.py first.")

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    SCALED_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(RAW_CSV)
    clean_df, cleaner = clean(raw)
    clean_df.to_csv(CLEAN_CSV, index=False)
    joblib.dump(cleaner, CLEANER_PATH)

    scaled_df, scaler, scale_cols = scale(clean_df)
    scaled_df.to_csv(SCALED_CSV, index=False)
    joblib.dump(scaler, SCALER_PATH)

    print(f"Clean → {CLEAN_CSV} ({clean_df.shape})")
    print(f"Scaled → {SCALED_CSV} ({scaled_df.shape})")
    print(f"Cleaner → {CLEANER_PATH}")
    print(f"Scaler → {SCALER_PATH}")
    print("Scale columns:", scale_cols)
    print("Feature columns:", [c for c in scaled_df.columns if c != TARGET_COL])


if __name__ == "__main__":
    main()
