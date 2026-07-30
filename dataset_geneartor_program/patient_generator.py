from __future__ import annotations

import random

from rules import *


class PatientGenerator:

    def __init__(self):
        self.patient = {}

    # ======================================================
    # Helper Functions
    # ======================================================

    def _sample(self, table_or_options, probabilities=None):
        if probabilities is None:
            return random.choices(
                table_or_options["options"],
                weights=table_or_options["probabilities"],
                k=1,
            )[0]

        return random.choices(
            table_or_options,
            weights=probabilities,
            k=1,
        )[0]

    def _sample_profile(self, options, probabilities):
        return random.choices(
            options,
            weights=probabilities,
            k=1,
        )[0]

    def _random_from_range(self, range_dict, category):
        low, high = range_dict[category]

        if isinstance(low, float) or isinstance(high, float):
            return round(random.uniform(low, high), 1)

        return random.randint(int(low), int(high))

    def _randint_range(self, low, high):
        low, high = int(low), int(high)
        if high < low:
            high = low
        return random.randint(low, high)

    def _uniform_range(self, low, high, ndigits=1):
        if high < low:
            high = low
        return round(random.uniform(low, high), ndigits)

    def _apgar_improve(self, score_1min, severe_case=False):

        if score_1min == 2:
            return 2

        if score_1min == 1:
            if severe_case:
                return self._sample([1, 2], [0.70, 0.30])
            return self._sample([1, 2], [0.35, 0.65])

        # score_1min == 0
        if severe_case:
            return self._sample([0, 1, 2], [0.60, 0.35, 0.05])
        return self._sample([0, 1, 2], [0.25, 0.55, 0.20])

    def _set_suspected_sepsis_from_risk(self):

        sepsis_risk = self.patient["SepsisRisk"]
        self.patient["SuspectedSepsis"] = self._sample_profile(
            ["Yes", "No"],
            SUSPECTED_SEPSIS_GIVEN_RISK[sepsis_risk],
        )

    def _maternal_pregnancy_risk_score(self):

        score = 0

        if self.patient["MultipleBirth"] == "Yes":
            score += 2

        if self.patient["MaternalHypertension"] == "Yes":
            score += 2

        if self.patient["GestationalDiabetes"] == "Yes":
            score += 1

        if self.patient["ProlongedRuptureOfMembranes"] == "Yes":
            score += 2

        visits = self.patient["AntenatalVisits"]
        if visits == 0:
            score += 2
        elif visits <= 3:
            score += 1

        age = self.patient["MotherAge"]
        if age < 18 or age >= 40:
            score += 1

        return score

    def _ga_appropriate_weight(self, gestational_age, severity):

        if gestational_age <= 24:
            low, high = 500, 700
        elif gestational_age <= 25:
            low, high = 550, 800
        elif gestational_age <= 26:
            low, high = 600, 900
        elif gestational_age <= 27:
            low, high = 700, 1000
        elif gestational_age <= 29:
            low, high = 900, 1500
        elif gestational_age <= 31:
            low, high = 1100, 1800
        elif gestational_age <= 33:
            low, high = 1400, 2300
        elif gestational_age <= 35:
            low, high = 1800, 2700
        elif gestational_age <= 37:
            low, high = 2200, 3200
        else:
            low, high = 2800, 4200

        # Gestational diabetes → larger infant (macrosomia if term).
        if self.patient["GestationalDiabetes"] == "Yes":
            if gestational_age >= 37:
                low += 250
                high += 500
            else:
                low += 100
                high += 250

        # Hypertensive disorders → placental insufficiency / SGA.
        if self.patient["MaternalHypertension"] == "Yes":
            low = max(400, low - 250)
            high = max(low + 40, high - 300)

        if self.patient["MultipleBirth"] == "Yes":
            low = max(400, low - 180)
            high = max(low + 40, high - 220)

        # Inadequate antenatal care: mild growth penalty.
        if self.patient["AntenatalVisits"] <= 3:
            low = max(400, low - 80)
            high = max(low + 40, high - 100)

        # Hard clamp to severity envelope (prevents term+ELBW etc.).
        # Term catastrophic pathway uses term weight bands.
        if self.patient.get("_TermCatastrophe"):
            sev_low, sev_high = 2600, 4200
        else:
            sev_low, sev_high = SEVERITY_BIRTH_WEIGHT_RANGES[severity]

        # Allow GDM macrosomia to exceed Healthy upper slightly when term.
        if (
            severity == "Healthy"
            and self.patient["GestationalDiabetes"] == "Yes"
            and gestational_age >= 38
        ):
            sev_high = max(sev_high, 4800)

        low = max(low, sev_low)
        high = min(high, sev_high)

        if high < low:
            low, high = sev_low, sev_high

        return self._randint_range(low, high)

    # ======================================================
    # 1. Maternal History
    # ======================================================

    def generate_maternal_history(self):

        mother_age_group = self._sample(MOTHER_AGE)
        mother_age = self._random_from_range(
            MOTHER_AGE_RANGES,
            mother_age_group,
        )
        self.patient["MotherAge"] = mother_age
        self.patient["_MotherAgeGroup"] = mother_age_group

        self.patient["Sex"] = self._sample(SEX)

        if mother_age_group == "15-19":
            mb_probs = MULTIPLE_BIRTH_PROFILES["young_mother"]
            htn_probs = MATERNAL_HYPERTENSION_PROFILES["young_mother"]
            gdm_probs = GESTATIONAL_DIABETES_PROFILES["young_mother"]
        elif mother_age_group == "35-48":
            mb_probs = MULTIPLE_BIRTH_PROFILES["older_mother"]
            htn_probs = MATERNAL_HYPERTENSION_PROFILES["older_mother"]
            gdm_probs = GESTATIONAL_DIABETES_PROFILES["older_mother"]
        else:
            mb_probs = MULTIPLE_BIRTH_PROFILES["baseline"]
            htn_probs = MATERNAL_HYPERTENSION_PROFILES["baseline"]
            gdm_probs = GESTATIONAL_DIABETES_PROFILES["baseline"]

        self.patient["MultipleBirth"] = self._sample_profile(
            MULTIPLE_BIRTH["options"],
            mb_probs,
        )
        self.patient["MaternalHypertension"] = self._sample_profile(
            MATERNAL_HYPERTENSION["options"],
            htn_probs,
        )
        self.patient["GestationalDiabetes"] = self._sample_profile(
            GESTATIONAL_DIABETES["options"],
            gdm_probs,
        )

        if self.patient["GestationalDiabetes"] == "Yes":
            visit_band_probs = [0.02, 0.08, 0.35, 0.55]
        elif mother_age_group == "15-19":
            visit_band_probs = [0.10, 0.25, 0.40, 0.25]
        else:
            visit_band_probs = ANTENATAL_VISITS["band_probabilities"]

        # Exact visit count (0–12), not coarse bands — better for ML.
        visit_band = self._sample_profile(
            ANTENATAL_VISITS["band_options"],
            visit_band_probs,
        )
        if visit_band == "0":
            antenatal_visits = 0
        elif visit_band == "1-3":
            antenatal_visits = self._randint_range(1, 3)
        elif visit_band == "4-7":
            antenatal_visits = self._randint_range(4, 7)
        else:
            antenatal_visits = self._randint_range(8, ANTENATAL_VISITS["exact_max"])

        self.patient["AntenatalVisits"] = antenatal_visits

        visits = antenatal_visits
        if visits == 0:
            prom_probs = [0.28, 0.72]
        elif visits <= 3:
            prom_probs = [0.18, 0.82]
        elif visits <= 7:
            prom_probs = [0.10, 0.90]
        else:
            prom_probs = [0.06, 0.94]

        self.patient["ProlongedRuptureOfMembranes"] = (
            self._sample_profile(PROM["options"], prom_probs)
        )

        return self.patient

    # ======================================================
    # 2. Pregnancy & Birth
    # ======================================================

    def generate_pregnancy_birth(self):

        # --------------------------------------------------
        # Clinical Severity (central latent)
        # Shifted by maternal / pregnancy risk score.
        # --------------------------------------------------

        risk = self._maternal_pregnancy_risk_score()

        if risk >= 5:
            sev_probs = CLINICAL_SEVERITY_PROFILES["high_maternal_risk"]
        elif risk >= 3:
            sev_probs = CLINICAL_SEVERITY_PROFILES["moderate_maternal_risk"]
        elif risk >= 1:
            sev_probs = CLINICAL_SEVERITY_PROFILES["mild_maternal_risk"]
        else:
            sev_probs = CLINICAL_SEVERITY_PROFILES["baseline"]

        severity = self._sample_profile(
            CLINICAL_SEVERITY["options"],
            sev_probs,
        )
        self.patient["ClinicalSeverity"] = severity

        # --------------------------------------------------
        # Delivery Mode ← severity (+ maternal emergencies)
        # --------------------------------------------------

        delivery_probs = list(SEVERITY_DELIVERY_MODE[severity])

        # PROM / hypertension nudge toward emergency CS.
        if self.patient["ProlongedRuptureOfMembranes"] == "Yes":
            delivery_probs[3] += 0.10
            delivery_probs[0] = max(0.0, delivery_probs[0] - 0.10)

        if self.patient["MaternalHypertension"] == "Yes":
            delivery_probs[3] += 0.08
            delivery_probs[0] = max(0.0, delivery_probs[0] - 0.08)

        total = sum(delivery_probs)
        delivery_probs = [p / total for p in delivery_probs]

        self.patient["DeliveryMode"] = self._sample_profile(
            DELIVERY_MODE["options"],
            delivery_probs,
        )

        # --------------------------------------------------
        # Gestational Age ← severity envelope + maternal bias
        # HTN / PROM / multiples / poor ANC → earlier within band
        # --------------------------------------------------

        ga_low, ga_high = SEVERITY_GESTATIONAL_AGE_RANGES[severity]
        self.patient["_TermCatastrophe"] = False

        if severity == "Critical" and random.random() < 0.18:
            gestational_age = self._randint_range(24, 25)
        elif severity == "Healthy" and random.random() < 0.12:
            gestational_age = 37
        else:
            gestational_age = self._randint_range(ga_low, ga_high)

        # Maternal conditions shift GA earlier inside the severity band.
        early_bias = 0
        if self.patient["MaternalHypertension"] == "Yes":
            early_bias += 1
        if self.patient["ProlongedRuptureOfMembranes"] == "Yes":
            early_bias += 1
        if self.patient["MultipleBirth"] == "Yes":
            early_bias += 1
        if self.patient["AntenatalVisits"] <= 3:
            early_bias += 1

        if early_bias > 0 and gestational_age > ga_low:
            shift = min(early_bias, gestational_age - ga_low)
            if random.random() < 0.70:
                gestational_age = max(ga_low, gestational_age - shift)

        if severity == "Healthy" and gestational_age == 37 and random.random() < 0.5:
            gestational_age = self._randint_range(38, 40)

        # Rare term catastrophic pathway: term infant with severe
        # intrapartum asphyxia / sepsis (clinically real, uncommon).
        if (
            severity in ("Moderate", "High")
            and random.random() < 0.035
        ):
            gestational_age = self._randint_range(37, 40)
            self.patient["_TermCatastrophe"] = True

        self.patient["GestationalAge"] = gestational_age

        # --------------------------------------------------
        # Birth Weight ← GA (primary) + maternal modifiers
        # --------------------------------------------------

        self.patient["BirthWeight"] = self._ga_appropriate_weight(
            gestational_age,
            severity,
        )

        return self.patient

    # ======================================================
    # 3. Neonatal Conditions
    # ======================================================

    def generate_neonatal_conditions(self):

        severity = self.patient["ClinicalSeverity"]
        gestational_age = self.patient["GestationalAge"]
        delivery_mode = self.patient["DeliveryMode"]
        prom = self.patient["ProlongedRuptureOfMembranes"]
        antenatal = self.patient["AntenatalVisits"]
        birth_weight = self.patient["BirthWeight"]

        # --------------------------------------------------
        # Birth Asphyxia ← severity + GA + delivery + ANC
        # --------------------------------------------------

        asphyxia_probs = list(SEVERITY_BIRTH_ASPHYXIA[severity])

        if delivery_mode == "Emergency C-section":
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.10)
            asphyxia_probs[2] += 0.05
            asphyxia_probs[3] += 0.05

        if delivery_mode == "Assisted forceps":
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.05)
            asphyxia_probs[1] += 0.03
            asphyxia_probs[2] += 0.02

        # Prematurity strongly increases asphyxia risk.
        if gestational_age < 28:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.12)
            asphyxia_probs[3] += 0.12
        elif gestational_age < 32:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.08)
            asphyxia_probs[2] += 0.04
            asphyxia_probs[3] += 0.04
        elif gestational_age < 37:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.04)
            asphyxia_probs[1] += 0.04

        if birth_weight < 1000:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.06)
            asphyxia_probs[3] += 0.06
        elif birth_weight < 1500:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.03)
            asphyxia_probs[2] += 0.03

        if antenatal == 0:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.08)
            asphyxia_probs[2] += 0.04
            asphyxia_probs[3] += 0.04
        elif antenatal <= 3:
            asphyxia_probs[0] = max(0.0, asphyxia_probs[0] - 0.04)
            asphyxia_probs[1] += 0.04

        total = sum(asphyxia_probs) or 1.0
        asphyxia_probs = [p / total for p in asphyxia_probs]

        if severity == "Healthy":
            asphyxia_probs = [0.94, 0.06, 0.0, 0.0]

        self.patient["BirthAsphyxia"] = self._sample_profile(
            BIRTH_ASPHYXIA["options"],
            asphyxia_probs,
        )

        # --------------------------------------------------
        # RDS ← severity + asphyxia + prematurity (strongest driver)
        # --------------------------------------------------

        rds_probs = list(SEVERITY_RDS[severity])
        asphyxia = self.patient["BirthAsphyxia"]

        if asphyxia == "Mild":
            rds_probs[0] = max(0.0, rds_probs[0] - 0.05)
            rds_probs[1] += 0.05
        elif asphyxia == "Moderate":
            rds_probs[0] = max(0.0, rds_probs[0] - 0.10)
            rds_probs[2] += 0.05
            rds_probs[3] += 0.05
        elif asphyxia == "Severe":
            rds_probs[0] = max(0.0, rds_probs[0] - 0.15)
            rds_probs[2] += 0.05
            rds_probs[3] += 0.10

        if gestational_age < 28:
            rds_probs[0] = max(0.0, rds_probs[0] - 0.15)
            rds_probs[3] += 0.15
        elif gestational_age < 32:
            rds_probs[0] = max(0.0, rds_probs[0] - 0.10)
            rds_probs[2] += 0.05
            rds_probs[3] += 0.05
        elif gestational_age < 34:
            rds_probs[0] = max(0.0, rds_probs[0] - 0.06)
            rds_probs[1] += 0.03
            rds_probs[2] += 0.03
        elif gestational_age >= 37:
            # Term: severe RDS uncommon unless asphyxia/severity high.
            rds_probs[3] *= 0.35
            rds_probs[2] *= 0.70
            rds_probs[0] += 0.10

        if birth_weight < 1000:
            rds_probs[0] = max(0.0, rds_probs[0] - 0.08)
            rds_probs[3] += 0.08
        elif birth_weight < 1500:
            rds_probs[0] = max(0.0, rds_probs[0] - 0.04)
            rds_probs[2] += 0.04

        if prom == "Yes":
            rds_probs[0] = max(0.0, rds_probs[0] - 0.04)
            rds_probs[1] += 0.04

        total = sum(rds_probs) or 1.0
        rds_probs = [p / total for p in rds_probs]

        if severity == "Healthy":
            rds_probs = [0.96, 0.04, 0.0, 0.0]

        self.patient["RespiratoryDistressSyndrome"] = (
            self._sample_profile(
                RESPIRATORY_DISTRESS_SYNDROME["options"],
                rds_probs,
            )
        )

        # --------------------------------------------------
        # Sepsis ← severity + PROM (strong) + prematurity + ANC
        # --------------------------------------------------

        sepsis_probs = list(SEVERITY_SEPSIS_RISK[severity])

        if prom == "Yes":
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.22)
            sepsis_probs[1] += 0.07
            sepsis_probs[2] += 0.15

        if gestational_age < 28:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.15)
            sepsis_probs[2] += 0.15
        elif gestational_age < 32:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.10)
            sepsis_probs[2] += 0.10
        elif gestational_age < 37:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.05)
            sepsis_probs[1] += 0.05

        if birth_weight < 1500:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.06)
            sepsis_probs[2] += 0.06

        if antenatal == 0:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.10)
            sepsis_probs[2] += 0.10
        elif antenatal <= 3:
            sepsis_probs[0] = max(0.0, sepsis_probs[0] - 0.05)
            sepsis_probs[1] += 0.05

        total = sum(sepsis_probs) or 1.0
        sepsis_probs = [p / total for p in sepsis_probs]

        if severity == "Healthy":
            sepsis_probs = [0.95, 0.05, 0.0]

        sepsis_risk = self._sample_profile(
            SEPSIS_RISK["options"],
            sepsis_probs,
        )
        self.patient["SepsisRisk"] = sepsis_risk
        self._set_suspected_sepsis_from_risk()

        # --------------------------------------------------
        # Severity hard floors (consistency, with residual diversity)
        # --------------------------------------------------

        if severity == "Critical":
            # Must show substantial disease, but not identical templates.
            if (
                self.patient["BirthAsphyxia"] in ("None", "Mild")
                and self.patient["RespiratoryDistressSyndrome"]
                in ("None", "Mild")
            ):
                self.patient["RespiratoryDistressSyndrome"] = self._sample(
                    ["Moderate", "Severe"],
                    [0.35, 0.65],
                )
                if self.patient["BirthAsphyxia"] == "None":
                    self.patient["BirthAsphyxia"] = self._sample(
                        ["Moderate", "Severe"],
                        [0.45, 0.55],
                    )

            if self.patient["SepsisRisk"] == "Low":
                self.patient["SepsisRisk"] = self._sample(
                    ["Medium", "High"],
                    [0.35, 0.65],
                )
                self._set_suspected_sepsis_from_risk()

        elif severity == "High":
            if (
                self.patient["BirthAsphyxia"] == "None"
                and self.patient["RespiratoryDistressSyndrome"] == "None"
            ):
                self.patient["RespiratoryDistressSyndrome"] = self._sample(
                    ["Mild", "Moderate", "Severe"],
                    [0.30, 0.45, 0.25],
                )

        elif severity == "Healthy":
            self.patient["BirthAsphyxia"] = self._sample(
                ["None", "Mild"],
                [0.94, 0.06],
            )
            self.patient["RespiratoryDistressSyndrome"] = self._sample(
                ["None", "Mild"],
                [0.96, 0.04],
            )
            self.patient["SepsisRisk"] = "Low"
            self._set_suspected_sepsis_from_risk()

        # Rare term catastrophe: severe asphyxia +/- sepsis at term.
        if self.patient.get("_TermCatastrophe"):
            self.patient["BirthAsphyxia"] = self._sample(
                ["Moderate", "Severe"],
                [0.35, 0.65],
            )
            self.patient["RespiratoryDistressSyndrome"] = self._sample(
                ["None", "Mild", "Moderate"],
                [0.35, 0.40, 0.25],
            )
            if random.random() < 0.55:
                self.patient["SepsisRisk"] = "High"
            else:
                self.patient["SepsisRisk"] = self._sample(
                    ["Medium", "High"],
                    [0.40, 0.60],
                )
            self._set_suspected_sepsis_from_risk()

        return self.patient


    # ======================================================
    # 4. Vital Signs
    # ======================================================

    def generate_vital_signs(self):

        severity = self.patient["ClinicalSeverity"]
        asphyxia = self.patient["BirthAsphyxia"]
        rds = self.patient["RespiratoryDistressSyndrome"]
        sepsis = self.patient["SuspectedSepsis"]
        ga = self.patient["GestationalAge"]
        gdm = self.patient["GestationalDiabetes"]

        # ---------- Temperature ----------
        # Severity gates depth of hypothermia: Moderate must never look
        # like severe cold injury (e.g. 33.7°C with mild disease).
        if severity == "Healthy":
            # Normal-range biological variability (not identical clones).
            r = random.random()
            if r < 0.12:
                temperature = self._uniform_range(36.3, 36.5)
            elif r < 0.18:
                temperature = self._uniform_range(37.5, 37.7)
            else:
                temperature = self._uniform_range(36.5, 37.5)
        elif severity == "Moderate":
            # Late-preterm / borderline NICU: mild instability only.
            # Floor 35.0°C — severe hypothermia requires High/Critical.
            if sepsis == "Yes":
                r = random.random()
                if r < 0.40:
                    temperature = self._uniform_range(35.0, 36.4)
                elif r < 0.65:
                    temperature = self._uniform_range(37.6, 38.5)
                else:
                    temperature = self._uniform_range(36.4, 37.5)
            else:
                r = random.random()
                if r < 0.45:
                    temperature = self._uniform_range(35.0, 36.4)
                elif r < 0.55:
                    temperature = self._uniform_range(37.6, 38.0)
                else:
                    temperature = self._uniform_range(36.4, 37.4)
        elif sepsis == "Yes":
            # High / Critical sepsis: fever or hypothermia allowed.
            category = self._sample_profile(
                TEMPERATURE["options"],
                TEMPERATURE_PROFILES["sepsis"],
            )
            temperature = self._random_from_range(
                TEMPERATURE_RANGES,
                category,
            )
            # High: avoid extreme cold injury (<33.5) unless Critical.
            if severity == "High" and temperature < 33.5:
                temperature = self._uniform_range(33.5, 35.5)
        elif severity == "Critical" or ga < 28:
            category = self._sample_profile(
                TEMPERATURE["options"],
                TEMPERATURE_PROFILES["critical"],
            )
            temperature = self._random_from_range(
                TEMPERATURE_RANGES,
                category,
            )
            if sepsis != "Yes" and temperature > 37.5:
                temperature = self._uniform_range(32.5, 35.8)
        elif severity == "High":
            # Very preterm High-risk: hypothermia common; deep cold ok.
            category = self._sample_profile(
                TEMPERATURE["options"],
                TEMPERATURE_PROFILES["preterm"],
            )
            temperature = self._random_from_range(
                TEMPERATURE_RANGES,
                category,
            )
        else:
            temperature = self._uniform_range(35.8, 37.4)

        self.patient["Temperature"] = temperature

        # ---------- Heart Rate ----------
        # Asphyxia → bradycardia; sepsis → tachycardia.
        # Healthy / mild illness: rarely > 170 bpm.
        if severity == "Healthy":
            # Full normal neonatal band with natural spread.
            heart_rate = self._randint_range(118, 162)
        elif asphyxia == "Severe":
            if severity == "Moderate":
                # Severe asphyxia in Moderate stays depressed, not agonal.
                heart_rate = self._randint_range(90, 120)
            elif sepsis == "Yes" and severity in ("High", "Critical"):
                if random.random() < 0.20:
                    heart_rate = self._randint_range(165, 195)
                else:
                    heart_rate = self._randint_range(50, 95)
            else:
                heart_rate = self._randint_range(50, 95)
        elif asphyxia == "Moderate":
            heart_rate = self._randint_range(85, 120)
        elif sepsis == "Yes":
            if severity == "Critical":
                heart_rate = self._randint_range(165, 205)
            elif severity == "High":
                heart_rate = self._randint_range(155, 195)
            else:
                heart_rate = self._randint_range(150, 175)
        elif severity == "Moderate":
            # Mild stress: mostly normal-high, occasional mild tachy.
            if asphyxia == "Mild" or rds in ("Mild", "Moderate"):
                heart_rate = self._randint_range(125, 168)
            else:
                heart_rate = self._randint_range(115, 160)
        elif severity == "High":
            heart_rate = self._randint_range(110, 175)
        else:
            heart_rate = self._randint_range(90, 170)

        self.patient["HeartRate"] = heart_rate

        # ---------- Respiratory Rate ← RDS severity ----------
        if severity == "Healthy":
            respiratory_rate = self._randint_range(32, 52)
        elif asphyxia == "Severe" and rds == "Severe":
            if severity in ("High", "Critical") and random.random() < 0.40:
                respiratory_rate = self._randint_range(6, 18)
            else:
                respiratory_rate = self._randint_range(75, 100)
        elif rds == "Severe":
            respiratory_rate = self._randint_range(70, 95)
        elif rds == "Moderate":
            respiratory_rate = self._randint_range(58, 78)
        elif rds == "Mild":
            respiratory_rate = self._randint_range(48, 68)
        elif asphyxia in ("Moderate", "Severe"):
            respiratory_rate = self._randint_range(20, 40)
        elif severity == "Moderate":
            respiratory_rate = self._randint_range(40, 62)
        else:
            respiratory_rate = self._randint_range(30, 55)

        if respiratory_rate < 20 and not (
            (asphyxia == "Severe" and rds == "Severe")
            or severity == "Critical"
        ):
            respiratory_rate = self._randint_range(30, 55)

        # Sepsis often causes tachypnea even without severe RDS.
        if sepsis == "Yes" and respiratory_rate >= 20:
            respiratory_rate = min(100, respiratory_rate + self._randint_range(5, 15))

        self.patient["RespiratoryRate"] = respiratory_rate

        # ---------- SpO2 ← RDS + asphyxia + severity + sepsis ----------
        risk = 0
        if rds == "Mild":
            risk += 1
        elif rds == "Moderate":
            risk += 2
        elif rds == "Severe":
            risk += 3

        if asphyxia == "Mild":
            risk += 1
        elif asphyxia == "Moderate":
            risk += 2
        elif asphyxia == "Severe":
            risk += 3

        if sepsis == "Yes":
            risk += 1

        if severity == "Critical":
            risk += 2
        elif severity == "High":
            risk += 1

        if severity == "Healthy":
            # Mostly well oxygenated with natural room-air variation.
            r = random.random()
            if r < 0.10:
                spo2 = self._uniform_range(94.0, 96.0)
            elif r < 0.25:
                spo2 = self._uniform_range(96.0, 98.0)
            else:
                spo2 = self._uniform_range(97.0, 100.0)
        elif severity == "Moderate":
            # Borderline oxygenation linked to RDS / asphyxia / sepsis.
            if risk >= 3:
                spo2 = self._uniform_range(86.0, 93.0)
            elif risk >= 1:
                spo2 = self._uniform_range(90.0, 95.0)
            else:
                spo2 = self._uniform_range(93.0, 97.0)
        elif severity == "Critical":
            if risk >= 6:
                spo2 = self._uniform_range(55.0, 78.0)
            else:
                spo2 = self._uniform_range(70.0, 88.0)
            # Usually hypoxic; uncommon near-normal SpO2 in Critical.
            if random.random() < 0.90:
                spo2 = min(spo2, 90.0)
            else:
                spo2 = min(spo2, 93.0)
        elif rds == "Severe":
            spo2 = self._uniform_range(65.0, 85.0)
        elif risk >= 5:
            spo2 = self._uniform_range(74.0, 88.0)
        elif risk >= 3:
            spo2 = self._uniform_range(82.0, 92.0)
        elif risk >= 1:
            spo2 = self._uniform_range(88.0, 96.0)
        else:
            spo2 = self._uniform_range(93.0, 98.0)

        self.patient["SpO₂"] = spo2

        # ---------- Blood Glucose ← prematurity / GDM / sepsis ----------
        hypo = 0
        if ga < 34:
            hypo += 2
        elif ga < 37:
            hypo += 1
        if gdm == "Yes":
            hypo += 2
        if sepsis == "Yes":
            hypo += 2
        if severity == "Critical":
            hypo += 2
        elif severity == "High":
            hypo += 1
        elif severity == "Moderate":
            hypo += 1

        if severity == "Healthy" and gdm != "Yes":
            glucose = self._uniform_range(50.0, 115.0)
        elif severity == "Healthy" and gdm == "Yes":
            glucose = self._uniform_range(40.0, 90.0)
        elif severity == "Moderate":
            # Mild hypoglycemia common but not universal in late preterm.
            if random.random() < 0.35:
                glucose = self._uniform_range(35.0, 50.0)
            elif hypo >= 3:
                glucose = self._uniform_range(40.0, 75.0)
            else:
                glucose = self._uniform_range(48.0, 100.0)
        elif hypo >= 6:
            glucose = (
                self._uniform_range(15.0, 35.0)
                if random.random() < 0.75
                else self._uniform_range(140.0, 200.0)
            )
        elif hypo >= 4:
            glucose = self._uniform_range(20.0, 45.0)
        elif hypo >= 2:
            glucose = self._uniform_range(30.0, 70.0)
        else:
            glucose = self._uniform_range(45.0, 110.0)

        self.patient["BloodGlucose"] = glucose

        return self.patient

    # ======================================================
    # 5. APGAR
    # ======================================================

    def generate_apgar(self):

        severity = self.patient["ClinicalSeverity"]
        asphyxia = self.patient["BirthAsphyxia"]
        rds = self.patient["RespiratoryDistressSyndrome"]
        sepsis = self.patient["SuspectedSepsis"]
        spo2 = self.patient["SpO₂"]
        heart_rate = self.patient["HeartRate"]
        rr = self.patient["RespiratoryRate"]

        severe_case = (
            severity in ("High", "Critical")
            or asphyxia == "Severe"
            or rds == "Severe"
        )

        # ---------- Appearance ← SpO₂ + perfusion ----------
        appearance_risk = 0
        if spo2 < 85:
            appearance_risk += 3
        elif spo2 < 92:
            appearance_risk += 2
        elif spo2 < 95:
            appearance_risk += 1

        if heart_rate < 100:
            appearance_risk += 2
        elif heart_rate < 120 and asphyxia in ("Moderate", "Severe"):
            appearance_risk += 1

        if asphyxia == "Severe":
            appearance_risk += 1

        if appearance_risk >= 4:
            appearance1 = 0
        elif appearance_risk >= 2:
            appearance1 = 1
        else:
            appearance1 = 2

        # ---------- Pulse ← HR + clinical condition ----------
        if heart_rate >= 100:
            pulse1 = 2
        elif heart_rate > 0:
            pulse1 = 1
        else:
            pulse1 = 0

        if (
            severity == "Critical"
            and asphyxia == "Severe"
            and 100 <= heart_rate < 110
            and random.random() < 0.45
        ):
            pulse1 = 1

        # ---------- Grimace ← asphyxia + neuro depression ----------
        grimace_risk = 0
        if asphyxia == "Mild":
            grimace_risk += 1
        elif asphyxia == "Moderate":
            grimace_risk += 2
        elif asphyxia == "Severe":
            grimace_risk += 3

        if sepsis == "Yes":
            grimace_risk += 1

        if severity == "Critical":
            grimace_risk += 2
        elif severity == "High":
            grimace_risk += 1

        if grimace_risk >= 4:
            grimace1 = 0
        elif grimace_risk >= 2:
            grimace1 = 1
        else:
            grimace1 = 2

        # ---------- Activity ← asphyxia + severity ----------
        if asphyxia == "Severe":
            activity1 = 0
        elif asphyxia == "Moderate":
            activity1 = 1
        elif asphyxia == "Mild":
            activity1 = self._sample([1, 2], [0.65, 0.35])
        else:
            activity1 = 2

        if severity == "Critical":
            activity1 = min(activity1, 1)
            if asphyxia in ("Moderate", "Severe"):
                activity1 = 0
        elif severity == "High":
            if asphyxia != "None":
                activity1 = min(activity1, 1)
            elif rds in ("Moderate", "Severe"):
                activity1 = min(activity1, 1)

        # ---------- Respiration ← RR + RDS + effort ----------
        resp_risk = 0
        if rds == "Mild":
            resp_risk += 1
        elif rds == "Moderate":
            resp_risk += 2
        elif rds == "Severe":
            resp_risk += 3

        if rr < 20:
            resp_risk += 3
        elif rr < 30:
            resp_risk += 2
        elif rr >= 70:
            resp_risk += 2
        elif rr >= 60:
            resp_risk += 1

        if severity == "Critical":
            resp_risk += 1

        if resp_risk >= 4:
            respiration1 = 0
        elif resp_risk >= 2:
            respiration1 = 1
        else:
            respiration1 = 2

        # ---------- Severity floors / ceilings ----------
        if severity == "Healthy":
            # Mostly vigorous; APGAR totals typically 8–10 (not always 10).
            appearance1 = pulse1 = grimace1 = activity1 = respiration1 = 2
            r = random.random()
            if r < 0.22:
                mild = self._sample(
                    ["Appearance", "Grimace", "Activity", "Respiration"],
                    [0.25, 0.25, 0.25, 0.25],
                )
                if mild == "Appearance":
                    appearance1 = 1
                elif mild == "Grimace":
                    grimace1 = 1
                elif mild == "Activity":
                    activity1 = 1
                else:
                    respiration1 = 1
            elif r < 0.30:
                # Two mild components → total 8
                appearance1 = 1
                respiration1 = 1
        elif severity == "Critical":
            # Typically depressed, but not a fixed template.
            appearance1 = min(appearance1, 1)
            grimace1 = min(grimace1, 1)
            activity1 = min(activity1, 1)
            if spo2 < 80:
                appearance1 = 0
            if (rds == "Severe" or rr < 25) and random.random() < 0.85:
                respiration1 = 0
            else:
                respiration1 = min(respiration1, 1)
        elif severity == "Moderate":
            # Intermediate picture: avoid both perfect 10 and critical collapse.
            total_tmp = appearance1 + pulse1 + grimace1 + activity1 + respiration1
            if total_tmp >= 10 and (rds != "None" or asphyxia != "None"):
                if rds != "None":
                    respiration1 = min(respiration1, 1)
                if asphyxia != "None":
                    activity1 = min(activity1, 1)
            elif total_tmp >= 10 and random.random() < 0.40:
                # Even disease-free moderate: occasional soft 9
                respiration1 = 1
            total_tmp = appearance1 + pulse1 + grimace1 + activity1 + respiration1
            if total_tmp <= 3:
                # Soft floor: moderate illness is not usually APGAR 0–3
                if appearance1 == 0:
                    appearance1 = 1
                if respiration1 == 0 and rds != "Severe":
                    respiration1 = 1
                if activity1 == 0 and asphyxia != "Severe":
                    activity1 = 1
        elif severity == "High":
            if appearance1 + pulse1 + grimace1 + activity1 + respiration1 >= 9:
                if rds in ("Moderate", "Severe"):
                    respiration1 = min(respiration1, 1)
                if asphyxia in ("Moderate", "Severe"):
                    activity1 = min(activity1, 1)
                    grimace1 = min(grimace1, 1)

        # ---------- Component coherence ----------
        components = {
            "Appearance": appearance1,
            "Pulse": pulse1,
            "Grimace": grimace1,
            "Activity": activity1,
            "Respiration": respiration1,
        }
        total = sum(components.values())

        if total <= 4:
            for name, value in list(components.items()):
                if value != 2:
                    continue
                if name == "Pulse" and heart_rate >= 100:
                    continue  # valid APGAR pulse rule
                components[name] = 1

        appearance1 = components["Appearance"]
        pulse1 = components["Pulse"]
        grimace1 = components["Grimace"]
        activity1 = components["Activity"]
        respiration1 = components["Respiration"]

        self.patient["Appearance1"] = appearance1
        self.patient["Pulse1"] = pulse1
        self.patient["Grimace1"] = grimace1
        self.patient["Activity1"] = activity1
        self.patient["Respiration1"] = respiration1

        self.patient["Appearance5"] = self._apgar_improve(
            appearance1, severe_case=severe_case
        )
        self.patient["Pulse5"] = self._apgar_improve(
            pulse1, severe_case=severe_case
        )
        self.patient["Grimace5"] = self._apgar_improve(
            grimace1, severe_case=severe_case
        )
        self.patient["Activity5"] = self._apgar_improve(
            activity1, severe_case=severe_case
        )
        self.patient["Respiration5"] = self._apgar_improve(
            respiration1, severe_case=severe_case
        )

        if severity == "Critical":
            apgar5 = (
                self.patient["Appearance5"]
                + self.patient["Pulse5"]
                + self.patient["Grimace5"]
                + self.patient["Activity5"]
                + self.patient["Respiration5"]
            )
            # Soft cap: Critical rarely looks fully recovered at 5 min.
            if apgar5 >= 8 and random.random() < 0.80:
                self.patient["Activity5"] = min(self.patient["Activity5"], 1)
                self.patient["Respiration5"] = min(
                    self.patient["Respiration5"], 1
                )
                self.patient["Appearance5"] = min(
                    self.patient["Appearance5"], 1
                )

        if severity == "Healthy":
            # Prefer excellent 5-min scores, but keep meaningful 8–9 share.
            for key in (
                "Appearance5",
                "Pulse5",
                "Grimace5",
                "Activity5",
                "Respiration5",
            ):
                if self.patient[key] < 2 and random.random() < 0.50:
                    self.patient[key] = 2
            r = random.random()
            if r < 0.28:
                soft = self._sample(
                    ["Appearance5", "Grimace5", "Activity5", "Respiration5"],
                    [0.25, 0.25, 0.25, 0.25],
                )
                self.patient[soft] = 1
            elif r < 0.36:
                self.patient["Appearance5"] = 1
                self.patient["Respiration5"] = 1

        if severity == "Moderate":
            # Keep 5-min scores in the intermediate NICU band when possible.
            keys5 = (
                "Appearance5",
                "Pulse5",
                "Grimace5",
                "Activity5",
                "Respiration5",
            )
            apgar5 = sum(self.patient[k] for k in keys5)
            if apgar5 >= 10 and random.random() < 0.55:
                soft = self._sample(
                    ["Appearance5", "Grimace5", "Activity5", "Respiration5"],
                    [0.25, 0.25, 0.25, 0.25],
                )
                self.patient[soft] = 1
            elif apgar5 <= 4 and random.random() < 0.70:
                for k in keys5:
                    if self.patient[k] == 0:
                        self.patient[k] = 1

        return self.patient
    # ======================================================
    # 6. Outcome (probabilistic mortality model)
    # ======================================================

    def _compute_mortality_score(self):

        p = self.patient
        severity = p["ClinicalSeverity"]

        apgar5 = (
            p["Appearance5"]
            + p["Pulse5"]
            + p["Grimace5"]
            + p["Activity5"]
            + p["Respiration5"]
        )

        ga = p["GestationalAge"]
        bw = p["BirthWeight"]
        asphyxia = p["BirthAsphyxia"]
        rds = p["RespiratoryDistressSyndrome"]
        sepsis = p["SuspectedSepsis"]
        spo2 = p["SpO₂"]
        temp = p["Temperature"]
        hr = p["HeartRate"]
        rr = p["RespiratoryRate"]
        glucose = p["BloodGlucose"]

        score = CLINICAL_RISK_BOUNDS["SEVERITY_MORTALITY_BIAS"][severity]

        if ga < 26:
            score += 5
        elif ga < 28:
            score += 4
        elif ga < 32:
            score += 3
        elif ga < 34:
            score += 2
        elif ga < 37:
            score += 1

        if bw < 750:
            score += 5
        elif bw < 1000:
            score += 4
        elif bw < 1500:
            score += 3
        elif bw < 2000:
            score += 2
        elif bw < 2500:
            score += 1

        if asphyxia == "Severe":
            score += 5
        elif asphyxia == "Moderate":
            score += 3
        elif asphyxia == "Mild":
            score += 1

        if rds == "Severe":
            score += 4
        elif rds == "Moderate":
            score += 2
        elif rds == "Mild":
            score += 1

        if sepsis == "Yes":
            score += 3
        elif p["SepsisRisk"] == "High":
            score += 1

        if spo2 < 70:
            score += 5
        elif spo2 < 80:
            score += 4
        elif spo2 < 90:
            score += 2
        elif spo2 < 94:
            score += 1

        if temp < 33.0:
            score += 5
        elif temp < 35.0:
            score += 3
        elif temp < 36.0:
            score += 2
        elif temp >= 39.0:
            score += 2

        if glucose < 25:
            score += 2
        elif glucose < 40:
            score += 1

        if hr < 80:
            score += 3
        elif hr < 100:
            score += 2
        elif hr > 200:
            score += 2
        elif hr > 180:
            score += 1

        if rr < 15:
            score += 3
        elif rr < 25:
            score += 2
        elif rr > 80:
            score += 2
        elif rr > 70:
            score += 1

        if apgar5 <= 2:
            score += 6
        elif apgar5 <= 3:
            score += 5
        elif apgar5 <= 5:
            score += 3
        elif apgar5 <= 6:
            score += 2

        if asphyxia == "Severe" and rds == "Severe":
            score += 2
        if sepsis == "Yes" and rds in ("Moderate", "Severe"):
            score += 1
        if ga < 28 and sepsis == "Yes":
            score += 1
        if asphyxia == "Severe" and spo2 < 80:
            score += 1
        if rds == "Severe" and temp < 36.0:
            score += 1
        if bw < 1000 and apgar5 <= 5:
            score += 1

        return score, apgar5

    def _is_immediate_high_risk(self, apgar5):

        p = self.patient
        severity = p["ClinicalSeverity"]

        ga = p["GestationalAge"]
        bw = p["BirthWeight"]
        asphyxia = p["BirthAsphyxia"]
        rds = p["RespiratoryDistressSyndrome"]
        sepsis = p["SuspectedSepsis"]
        spo2 = p["SpO₂"]
        temp = p["Temperature"]
        hr = p["HeartRate"]

        if ga < 24:
            return True
        if ga <= 24 and bw < 650:
            return True
        if bw < 500:
            return True
        if (
            rds == "Severe"
            and asphyxia == "Severe"
            and spo2 < 60
            and apgar5 <= 3
        ):
            return True
        if asphyxia == "Severe" and apgar5 <= 2 and spo2 < 70 and hr < 80:
            return True
        if (
            sepsis == "Yes"
            and temp < 33.5
            and rds == "Severe"
            and spo2 < 75
            and severity == "Critical"
        ):
            return True
        if apgar5 == 0 and spo2 < 60 and hr < 60:
            return True
        # Term catastrophic asphyxia / sepsis can be immediately high-risk.
        if (
            p.get("_TermCatastrophe")
            and asphyxia == "Severe"
            and apgar5 <= 4
            and spo2 < 80
        ):
            return True

        return False

    def generate_outcome(self):

        severity = self.patient["ClinicalSeverity"]
        score, apgar5 = self._compute_mortality_score()

        death_probability = mortality_probability_from_score(severity, score)

        if self._is_immediate_high_risk(apgar5):
            # Boost toward high risk, but keep survival possible.
            death_probability = max(
                death_probability,
                IMMEDIATE_DEATH_PROBABILITY,
            )
            # Extra uncertainty around extreme cases.
            death_probability = min(
                MORTALITY_PROB_CEILING,
                death_probability + random.uniform(-0.08, 0.05),
            )

        # Unobserved clinical factors (treatment response, biology, etc.).
        death_probability += random.uniform(-0.06, 0.06)
        death_probability = max(
            MORTALITY_PROB_FLOOR,
            min(MORTALITY_PROB_CEILING, death_probability),
        )

        if random.random() < death_probability:
            outcome = "Neonatal Death (Within 28 Days)"
        else:
            outcome = "Survived (Discharged Home)"

        self.patient["Outcome"] = outcome
        self.patient.pop("_MotherAgeGroup", None)
        self.patient.pop("_TermCatastrophe", None)

        return self.patient