import csv
import random
import sys
from pathlib import Path

from patient_generator import PatientGenerator


# ======================================================
# Dataset size (increase for ML training, e.g. 5000+)
# ======================================================

NUM_PATIENTS = 10000
EXPORT_CSV = True
# Write into the project dataset/ folder (parent of this package).
CSV_PATH = str(
    Path(__file__).resolve().parent.parent
    / "dataset"
    / "synthetic_neonatal_patients_raw.csv"
)
CSV_TMP_PATH = str(
    Path(__file__).resolve().parent.parent
    / "dataset"
    / "synthetic_neonatal_patients_raw.tmp.csv"
)
# Print every patient only for small demo runs.
VERBOSE = False

# Set an int to make runs reproducible (same patients every time).
# Set to None for a fresh random sample each run.
RANDOM_SEED = 42

# Features safe for ML (exclude nothing critical; Outcome is the label).
ML_FEATURE_ORDER = [
    "ClinicalSeverity",
    "MotherAge",
    "Sex",
    "MultipleBirth",
    "MaternalHypertension",
    "GestationalDiabetes",
    "AntenatalVisits",
    "ProlongedRuptureOfMembranes",
    "DeliveryMode",
    "GestationalAge",
    "BirthWeight",
    "BirthAsphyxia",
    "RespiratoryDistressSyndrome",
    "SuspectedSepsis",
    "Temperature",
    "HeartRate",
    "RespiratoryRate",
    "SpO₂",
    "BloodGlucose",
    "Appearance1",
    "Pulse1",
    "Grimace1",
    "Activity1",
    "Respiration1",
    "Appearance5",
    "Pulse5",
    "Grimace5",
    "Activity5",
    "Respiration5",
    "Outcome",
]


def generate_one():
    generator = PatientGenerator()
    generator.generate_maternal_history()
    generator.generate_pregnancy_birth()
    generator.generate_neonatal_conditions()
    generator.generate_vital_signs()
    generator.generate_apgar()
    generator.generate_outcome()
    return generator.patient


def main():

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if RANDOM_SEED is not None:
        random.seed(RANDOM_SEED)

    rows = []

    for i in range(NUM_PATIENTS):
        patient = generate_one()
        rows.append(patient)

        if VERBOSE:
            print("\n" + "=" * 60)
            print(f"Patient {i + 1}")
            print("=" * 60)
            for feature, value in patient.items():
                if str(feature).startswith("_"):
                    continue
                print(f"{feature:<35} : {value}")
            print("=" * 60)
        elif (i + 1) % 1000 == 0 or (i + 1) == NUM_PATIENTS:
            print(f"Generated {i + 1}/{NUM_PATIENTS} patients...")

    if EXPORT_CSV and rows:
        out_path = Path(CSV_PATH)
        tmp_path = Path(CSV_TMP_PATH)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        fieldnames = [f for f in ML_FEATURE_ORDER if f in rows[0]]
        extra = [
            k
            for k in rows[0]
            if k not in fieldnames and not str(k).startswith("_")
        ]
        fieldnames.extend(extra)

        with open(tmp_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=fieldnames, extrasaction="ignore"
            )
            writer.writeheader()
            for row in rows:
                writer.writerow({k: row.get(k) for k in fieldnames})

        try:
            tmp_path.replace(out_path)
            final_path = out_path
        except OSError:
            # Destination locked (often open in Excel/IDE) — keep temp file.
            final_path = tmp_path
            print(
                f"WARNING: could not overwrite {out_path} (file may be open). "
                f"Saved as {tmp_path} instead."
            )

        print(f"\nExported {len(rows)} patients → {final_path}")


if __name__ == "__main__":
    main()
