from __future__ import annotations

import math


# ==========================================================
# VALIDATION
# ==========================================================

def validate_probability_table(table: dict) -> None:
    """
    Ensures every probability table is valid.
    """

    if "options" not in table:
        raise ValueError("Probability table missing 'options'.")

    if "probabilities" not in table:
        raise ValueError("Probability table missing 'probabilities'.")

    if len(table["options"]) != len(table["probabilities"]):
        raise ValueError("Options and probabilities length mismatch.")

    total = sum(table["probabilities"])

    if abs(total - 1.0) > 1e-6:
        raise ValueError(
            f"Probabilities must sum to 1.0 (got {total})"
        )


# ==========================================================
# CLINICAL SEVERITY (central organizing variable)
# ==========================================================

CLINICAL_SEVERITY = {
    "options": ["Healthy", "Moderate", "High", "Critical"],
    # Enriched mix for mortality-prediction ML (not community births).
    "probabilities": [0.50, 0.28, 0.15, 0.07],
}

# Maternal / pregnancy risk shifts severity toward higher risk.
CLINICAL_SEVERITY_PROFILES = {
    "baseline": [0.55, 0.27, 0.13, 0.05],
    "mild_maternal_risk": [0.42, 0.32, 0.18, 0.08],
    "moderate_maternal_risk": [0.28, 0.35, 0.25, 0.12],
    "high_maternal_risk": [0.15, 0.30, 0.35, 0.20],
}


# Gestational age (weeks) allowed per severity — hard clinical envelopes.
SEVERITY_GESTATIONAL_AGE_RANGES = {
    "Healthy": (38, 40),
    "Moderate": (33, 36),  # classic late-preterm / borderline NICU window
    "High": (28, 33),
    "Critical": (24, 27),
}


# Birth-weight envelopes per severity (still refined by GA in generator).
SEVERITY_BIRTH_WEIGHT_RANGES = {
    "Healthy": (2800, 4200),
    "Moderate": (1700, 2900),
    "High": (1000, 2500),
    "Critical": (500, 999),
}


# Disease profiles keyed by severity — wider within-class diversity
# so ML cannot memorize a single template per severity.
SEVERITY_BIRTH_ASPHYXIA = {
    # options: None, Mild, Moderate, Severe
    "Healthy": [0.94, 0.06, 0.00, 0.00],
    "Moderate": [0.22, 0.50, 0.23, 0.05],  # mild asphyxia common in borderline cases
    "High": [0.10, 0.28, 0.38, 0.24],
    "Critical": [0.00, 0.10, 0.30, 0.60],
}

SEVERITY_RDS = {
    # options: None, Mild, Moderate, Severe
    "Healthy": [0.96, 0.04, 0.00, 0.00],
    "Moderate": [0.15, 0.48, 0.30, 0.07],  # mild/moderate RDS dominate
    "High": [0.08, 0.22, 0.38, 0.32],
    "Critical": [0.00, 0.08, 0.27, 0.65],
}

SEVERITY_SEPSIS_RISK = {
    # options: Low, Medium, High
    "Healthy": [0.95, 0.05, 0.00],
    "Moderate": [0.32, 0.48, 0.20],  # more medium-risk borderline sepsis workups
    "High": [0.12, 0.38, 0.50],
    "Critical": [0.02, 0.20, 0.78],
}

# P(SuspectedSepsis = Yes | SepsisRisk)
SUSPECTED_SEPSIS_GIVEN_RISK = {
    "Low": [0.03, 0.97],      # Yes, No
    "Medium": [0.42, 0.58],
    "High": [0.82, 0.18],
}


# Delivery mode by severity: NVD, forceps, elective CS, emergency CS
SEVERITY_DELIVERY_MODE = {
    "Healthy": [0.70, 0.03, 0.20, 0.07],
    "Moderate": [0.45, 0.08, 0.20, 0.27],
    "High": [0.20, 0.08, 0.22, 0.50],
    "Critical": [0.08, 0.05, 0.12, 0.75],
}


# ==========================================================
# NUMERIC RANGES
# ==========================================================

MOTHER_AGE_RANGES = {
    "15-19": (15, 19),
    "20-34": (20, 34),
    "35-48": (35, 48),
}

GESTATIONAL_AGE_RANGES = {
    "Extremely Preterm": (22, 27),
    "Very Preterm": (28, 31),
    "Moderate/Late Preterm": (32, 36),
    "Early Term": (37, 38),
    "Full Term": (39, 40),
    "Late Term": (41, 41),
    "Post Term": (42, 43),
}

BIRTH_WEIGHT_RANGES = {
    "Extremely Low Birth Weight": (400, 999),
    "Very Low Birth Weight": (1000, 1499),
    "Low Birth Weight": (1500, 2499),
    "Normal Birth Weight": (2500, 3999),
    "Macrosomia": (4000, 5500),
}

TEMPERATURE_RANGES = {
    "Severe Hypothermia": (32.0, 35.0),
    "Mild Hypothermia": (35.1, 36.4),
    "Normal": (36.5, 37.5),
    "Fever / Hyperthermia": (37.6, 40.0),
}

HEART_RATE_RANGES = {
    "Severe Bradycardia": (40, 99),
    "Mild Bradycardia": (100, 119),
    "Normal": (120, 160),
    "Tachycardia": (161, 200),
    "Severe Tachycardia": (201, 240),
}

RESPIRATORY_RATE_RANGES = {
    "Severe Bradypnea / Apnea": (5, 19),
    "Bradypnea": (20, 29),
    "Normal": (30, 60),
    "Tachypnea": (61, 100),
}

SPO2_RANGES = {
    "Severe Hypoxemia": (50, 84),
    "Mild/Moderate Hypoxemia": (85, 90),
    "Normal (NICU Target)": (91, 95),
    "Acceptable (Room Air)": (96, 100),
}

BLOOD_GLUCOSE_RANGES = {
    "Severe Hypoglycemia": (10, 24),
    "Hypoglycemia": (25, 44),
    "Normal": (45, 125),
    "Hyperglycemia": (126, 250),
}


# ==========================================================
# BASELINE PROBABILITY TABLES (maternal / pregnancy priors)
# ==========================================================

MOTHER_AGE = {
    "options": ["15-19", "20-34", "35-48"],
    "probabilities": [0.06, 0.78, 0.16],
}

SEX = {
    "options": ["Male", "Female"],
    "probabilities": [0.51, 0.49],
}

MULTIPLE_BIRTH = {
    "options": ["Yes", "No"],
    "probabilities": [0.04, 0.96],
}

MATERNAL_HYPERTENSION = {
    "options": ["Yes", "No"],
    "probabilities": [0.10, 0.90],
}

GESTATIONAL_DIABETES = {
    "options": ["Yes", "No"],
    "probabilities": [0.08, 0.92],
}

ANTENATAL_VISITS = {
    # Sampling uses visit bands, then expands to an exact integer count.
    # Exact count range for adequate care: 8–12 (WHO 8-contact model + extras).
    "band_options": ["0", "1-3", "4-7", "8+"],
    "band_probabilities": [0.04, 0.12, 0.36, 0.48],
    "exact_max": 12,
}


PROM = {
    "options": ["Yes", "No"],
    "probabilities": [0.12, 0.88],
}

DELIVERY_MODE = {
    "options": [
        "Normal Vaginal Delivery",
        "Assisted forceps",
        "Elective C-section",
        "Emergency C-section",
    ],
    "probabilities": [0.55, 0.05, 0.20, 0.20],
}

# Kept for classification / reference; GA is severity-driven in the generator.
GESTATIONAL_AGE = {
    "options": [
        "Extremely Preterm",
        "Very Preterm",
        "Moderate/Late Preterm",
        "Early Term",
        "Full Term",
        "Late Term",
        "Post Term",
    ],
    "probabilities": [0.02, 0.05, 0.13, 0.20, 0.52, 0.05, 0.03],
}

BIRTH_WEIGHT = {
    "options": [
        "Extremely Low Birth Weight",
        "Very Low Birth Weight",
        "Low Birth Weight",
        "Normal Birth Weight",
        "Macrosomia",
    ],
    "probabilities": [0.02, 0.05, 0.13, 0.75, 0.05],
}

BIRTH_ASPHYXIA = {
    "options": ["None", "Mild", "Moderate", "Severe"],
    "probabilities": [0.75, 0.14, 0.07, 0.04],
}

RESPIRATORY_DISTRESS_SYNDROME = {
    "options": ["None", "Mild", "Moderate", "Severe"],
    "probabilities": [0.74, 0.14, 0.08, 0.04],
}

SEPSIS_RISK = {
    "options": ["Low", "Medium", "High"],
    "probabilities": [0.75, 0.16, 0.09],
}

TEMPERATURE = {
    "options": list(TEMPERATURE_RANGES.keys()),
    "probabilities": [0.04, 0.12, 0.76, 0.08],
}

HEART_RATE = {
    "options": list(HEART_RATE_RANGES.keys()),
    "probabilities": [0.04, 0.07, 0.75, 0.12, 0.02],
}

RESPIRATORY_RATE = {
    "options": list(RESPIRATORY_RATE_RANGES.keys()),
    "probabilities": [0.03, 0.05, 0.70, 0.22],
}

SPO2 = {
    "options": list(SPO2_RANGES.keys()),
    "probabilities": [0.05, 0.10, 0.50, 0.35],
}

BLOOD_GLUCOSE = {
    "options": list(BLOOD_GLUCOSE_RANGES.keys()),
    "probabilities": [0.04, 0.12, 0.76, 0.08],
}


# ==========================================================
# CONDITIONAL MATERNAL PROFILES
# ==========================================================

MULTIPLE_BIRTH_PROFILES = {
    "baseline": [0.04, 0.96],
    "young_mother": [0.015, 0.985],
    "older_mother": [0.09, 0.91],
}

MATERNAL_HYPERTENSION_PROFILES = {
    "baseline": [0.10, 0.90],
    "young_mother": [0.05, 0.95],
    "older_mother": [0.22, 0.78],
}

GESTATIONAL_DIABETES_PROFILES = {
    "baseline": [0.08, 0.92],
    "young_mother": [0.03, 0.97],
    "older_mother": [0.18, 0.82],
}

TEMPERATURE_PROFILES = {
    "baseline": [0.02, 0.08, 0.85, 0.05],
    "sepsis": [0.22, 0.28, 0.12, 0.38],
    "preterm": [0.28, 0.42, 0.25, 0.05],
    "critical": [0.45, 0.35, 0.10, 0.10],
}


# ==========================================================
# CLINICAL INTERPRETATIONS
# ==========================================================

APGAR_INTERPRETATION = {
    (0, 3): "Severe Distress",
    (4, 6): "Moderate Distress",
    (7, 10): "Normal Adaptation",
}

GESTATIONAL_AGE_CLASSIFICATION = {
    (22.0, 27.99): "Extremely Preterm",
    (28.0, 31.99): "Very Preterm",
    (32.0, 36.99): "Moderate/Late Preterm",
    (37.0, 38.99): "Early Term",
    (39.0, 40.99): "Full Term",
    (41.0, 41.99): "Late Term",
    (42.0, 43.00): "Post Term",
}

BIRTH_WEIGHT_CLASSIFICATION = {
    (400, 999): "Extremely Low Birth Weight",
    (1000, 1499): "Very Low Birth Weight",
    (1500, 2499): "Low Birth Weight",
    (2500, 3999): "Normal Birth Weight",
    (4000, 5500): "Macrosomia",
}


# ==========================================================
# OUTCOME / MORTALITY MODEL (for ML label generation)
# ==========================================================
#
# Pipeline:
#   1. Immediate extreme combinations → very high P(death) (not 1.0)
#   2. Cumulative clinical risk score from all predictors
#   3. Map score → P(death) with severity-specific logistic curve
#   4. Bernoulli sample → Outcome
#
# Labels stay clinically associated with risk factors while
# ensuring no single variable is a perfect predictor.

# Baseline death probability by severity (before score adjustment).
# Intentionally non-extreme so every class has outcome overlap.
SEVERITY_BASE_DEATH_PROB = {
    "Healthy": 0.012,    # rare adverse events still possible
    "Moderate": 0.09,    # mostly survive; some die
    "High": 0.24,        # substantial risk; many still survive
    "Critical": 0.48,    # usually die; survival remains possible
}

# Logistic map: P = base + (cap - base) * sigmoid((score - mid) / scale)
# Caps never reach 1.0 — preserves real-world uncertainty.
SEVERITY_SCORE_LOGISTIC = {
    #                mid, scale, cap
    "Healthy": (18.0, 5.5, 0.08),
    "Moderate": (17.0, 5.5, 0.38),
    "High": (25.0, 6.0, 0.72),
    "Critical": (32.0, 6.5, 0.88),
}

# Extreme multi-factor illness raises P(death) but NEVER forces death.
IMMEDIATE_DEATH_PROBABILITY = 0.75

# Absolute floor/ceiling on any patient's death probability.
MORTALITY_PROB_FLOOR = 0.005
MORTALITY_PROB_CEILING = 0.92

CLINICAL_RISK_BOUNDS = {
    "APGAR_MINIMUM_SAFE": 7,
    "GESTATIONAL_AGE_PRETERM": 37.0,
    "BIRTH_WEIGHT_LOW": 2500,
    "TEMPERATURE_SAFE_RANGE": (36.5, 37.5),
    "GLUCOSE_SAFE_RANGE": (45, 125),
    "SPO2_SAFE_RANGE": (91, 95),
    "HEART_RATE_SAFE_RANGE": (120, 160),
    "RESPIRATORY_RATE_SAFE_RANGE": (30, 60),
    # Minimal severity prior — multi-factor score drives prognosis.
    "SEVERITY_MORTALITY_BIAS": {
        "Healthy": 0,
        "Moderate": 0,
        "High": 0,
        "Critical": 1,
    },
}


def mortality_probability_from_score(severity: str, score: float) -> float:
    """
    Convert cumulative clinical risk score into P(neonatal death).

    Probabilistic by design: same clinical picture can survive or die.
    Probability is bounded away from 0 and 1.
    """

    base = SEVERITY_BASE_DEATH_PROB[severity]
    mid, scale, cap = SEVERITY_SCORE_LOGISTIC[severity]

    z = (score - mid) / scale
    if z >= 0:
        sigmoid = 1.0 / (1.0 + math.exp(-z))
    else:
        ez = math.exp(z)
        sigmoid = ez / (1.0 + ez)

    probability = base + (cap - base) * sigmoid
    return max(MORTALITY_PROB_FLOOR, min(MORTALITY_PROB_CEILING, probability))


OUTCOME_LABELS = {
    "Survived (Discharged Home)": "Survived (Discharged Home)",
    "Neonatal Death (Within 28 Days)": "Neonatal Death (Within 28 Days)",
}


# ==========================================================
# VALIDATE TABLES ON IMPORT
# ==========================================================

for table in (
    CLINICAL_SEVERITY,
    MOTHER_AGE,
    SEX,
    MULTIPLE_BIRTH,
    MATERNAL_HYPERTENSION,
    GESTATIONAL_DIABETES,
    PROM,
    DELIVERY_MODE,
    GESTATIONAL_AGE,
    BIRTH_WEIGHT,
    BIRTH_ASPHYXIA,
    RESPIRATORY_DISTRESS_SYNDROME,
    SEPSIS_RISK,
    TEMPERATURE,
    HEART_RATE,
    RESPIRATORY_RATE,
    SPO2,
    BLOOD_GLUCOSE,
):
    validate_probability_table(table)

# Antenatal visit bands (exact integer drawn after band sampling).
validate_probability_table(
    {
        "options": ANTENATAL_VISITS["band_options"],
        "probabilities": ANTENATAL_VISITS["band_probabilities"],
    }
)
