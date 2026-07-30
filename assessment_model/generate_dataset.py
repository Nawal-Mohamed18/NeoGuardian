"""
Generate a synthetic re-assessment dataset for bedside NICU risk updates.

Assessment model = CHANGEABLE bedside state only (admit model owns birth context).
Features:
  CurrentWeight, WeightChangePct, vitals, SuspectedSepsis, RDS grade, BirthAsphyxia grade

GA / BirthWeight / Sex / DayOfLife are NOT model columns (admit-only).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "dataset"
RAW_CSV = DATASET_DIR / "assessment_reassess_raw.csv"

RANDOM_STATE = 42
N_DEFAULT = 10000

GRADES = ["None", "Mild", "Moderate", "Severe"]


def _clip(rng: np.random.Generator, arr: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return np.clip(arr, lo, hi)


def generate(n: int = N_DEFAULT, seed: int = RANDOM_STATE) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Latent severity (not a model feature) drives correlated bedside state + outcome.
    severity = rng.beta(2.0, 5.0, size=n)

    # Internal birth context only for simulating weight trajectory — not exported.
    gestational_age = _clip(
        rng,
        np.round(rng.normal(34.5 - 6 * severity, 3.2)).astype(float),
        24,
        42,
    ).astype(int)
    expected_bw = 100 * (gestational_age - 20) + rng.normal(0, 180, n) - 900 * severity
    birth_weight = _clip(rng, expected_bw, 500, 4800)
    day_of_life = rng.integers(1, 29, size=n)

    daily_gain = rng.normal(12 - 18 * severity, 8, n)  # g/day
    current_weight = _clip(
        rng,
        birth_weight + daily_gain * day_of_life + rng.normal(0, 40, n),
        400,
        5200,
    )
    weight_change_pct = (current_weight - birth_weight) / birth_weight

    def grade_from_severity(base: float) -> np.ndarray:
        score = _clip(rng, base + severity + rng.normal(0, 0.25, n), 0, 1)
        out = np.full(n, "None", dtype=object)
        out[score > 0.25] = "Mild"
        out[score > 0.45] = "Moderate"
        out[score > 0.7] = "Severe"
        return out

    rds = grade_from_severity(0.05 + 0.15 * (gestational_age < 32))
    asphyxia = grade_from_severity(-0.05)
    sepsis = np.where(rng.random(n) < (0.08 + 0.45 * severity), "Yes", "No")

    rds_severe = np.isin(rds, ["Moderate", "Severe"])
    temp = _clip(rng, rng.normal(36.7, 0.35, n) - 0.6 * severity, 34.0, 39.5)
    hr = _clip(rng, rng.normal(140, 15, n) + 25 * severity + 8 * rds_severe, 80, 220)
    rr = _clip(rng, rng.normal(45, 8, n) + 18 * severity + 10 * rds_severe, 20, 100)
    spo2 = _clip(rng, rng.normal(96, 2.5, n) - 12 * severity - 5 * rds_severe, 60, 100)
    glucose = _clip(
        rng, rng.normal(70, 15, n) - 25 * severity + rng.normal(0, 8, n), 20, 250
    )

    grade_code = {"None": 0, "Mild": 1, "Moderate": 2, "Severe": 3}
    rds_c = np.array([grade_code[g] for g in rds], dtype=float)
    asph_c = np.array([grade_code[g] for g in asphyxia], dtype=float)

    # Outcome depends on bedside / trajectory signals only (no GA/BW/Sex terms).
    logit = (
        -3.0
        + 2.9 * severity
        + 0.00045 * (2200 - current_weight).clip(0, 1600)
        + 1.15 * (weight_change_pct < -0.08).astype(float)
        + 0.75 * (weight_change_pct < -0.15).astype(float)
        + 0.38 * rds_c
        + 0.32 * asph_c
        + 0.95 * (sepsis == "Yes").astype(float)
        + 0.045 * (spo2 < 88).astype(float) * (100 - spo2) / 5
        + 0.028 * (hr > 170).astype(float) * (hr - 170) / 5
        + 0.032 * (temp < 36.0).astype(float) * (36.5 - temp) * 4
        + 0.022 * (glucose < 40).astype(float) * (45 - glucose) / 5
        + 0.018 * (rr > 70).astype(float) * (rr - 70) / 5
        + rng.normal(0, 0.55, n)
    )
    prob = 1 / (1 + np.exp(-logit))
    outcome = (rng.random(n) < prob).astype(int)

    return pd.DataFrame(
        {
            "CurrentWeight": np.round(current_weight, 1),
            "WeightChangePct": np.round(weight_change_pct, 4),
            "Temperature": np.round(temp, 2),
            "HeartRate": np.round(hr, 1),
            "RespiratoryRate": np.round(rr, 1),
            "SpO2": np.round(spo2, 1),
            "BloodGlucose": np.round(glucose, 1),
            "SuspectedSepsis": sepsis,
            "RespiratoryDistressSyndrome": rds,
            "BirthAsphyxia": asphyxia,
            "Outcome": outcome,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate assessment reassess synthetic dataset")
    parser.add_argument("--n", type=int, default=N_DEFAULT)
    parser.add_argument("--seed", type=int, default=RANDOM_STATE)
    args = parser.parse_args()

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    df = generate(n=args.n, seed=args.seed)
    df.to_csv(RAW_CSV, index=False)

    pos = int(df["Outcome"].sum())
    print(f"Wrote {RAW_CSV}")
    print(f"Rows={len(df)} deaths={pos} ({100 * pos / len(df):.1f}%) survivors={len(df) - pos}")
    print("Columns:", list(df.columns))


if __name__ == "__main__":
    main()
