from django.test import SimpleTestCase

from ai.fallback import get_fallback_assessment
from ai.ml_predictor import model_status, predict_risk


def _profile(**overrides):
    data = {
        "birth_weight": 3.1,
        "gestational_age": 38,
        "mother_age": 28,
        "gender": "female",
        "apgar_1min": 8,
        "apgar_5min": 9,
        "temperature": 36.8,
        "heart_rate": 140,
        "respiratory_rate": 42,
        "spo2": 98,
        "blood_glucose": 72,
        "antenatal_visits": 8,
        "maternal_hypertension": False,
        "maternal_diabetes": False,
        "delivery_vaginal": 1,
        "multiple_birth": False,
        "sepsis": False,
        "respiratory_distress_syndrome": False,
        "birth_asphyxia": False,
        "respiratory_support": "none",
        "feeding_difficulty": False,
        "risk_flags": [],
    }
    data.update(overrides)
    return data


class NeonatalModelTests(SimpleTestCase):
    def test_artifacts_load(self):
        status = model_status()
        self.assertTrue(status["model_loaded"])
        self.assertIn("calibrated_random_forest", status["model_version"])

    def test_representative_profiles_cover_all_tiers(self):
        low = predict_risk(_profile())
        moderate = predict_risk(
            _profile(
                gestational_age=35,
                birth_weight=2.2,
                apgar_1min=5,
                apgar_5min=7,
            )
        )
        high = predict_risk(
            _profile(
                gestational_age=26,
                birth_weight=0.8,
                apgar_1min=2,
                apgar_5min=3,
                temperature=35,
                heart_rate=185,
                respiratory_rate=75,
                spo2=78,
                blood_glucose=28,
                antenatal_visits=1,
                multiple_birth=True,
                sepsis=True,
                respiratory_distress_syndrome=True,
                birth_asphyxia=True,
                respiratory_support="ventilation",
                feeding_difficulty=True,
                risk_flags=["prematurity", "very_low_birth_weight"],
            )
        )

        self.assertIsNotNone(low)
        self.assertIsNotNone(moderate)
        self.assertIsNotNone(high)
        self.assertEqual(low["mortality_tier"], "Low")
        self.assertEqual(moderate["mortality_tier"], "Moderate")
        self.assertEqual(high["mortality_tier"], "High")
        self.assertLess(low["mortality_probability"], moderate["mortality_probability"])
        self.assertLess(moderate["mortality_probability"], high["mortality_probability"])

    def test_recommendations_are_grounded_in_recorded_factors(self):
        result = get_fallback_assessment(
            "High",
            ["Sepsis / sepsis suspicion", "SpO₂ outside 95–100% (82%)"],
            31.2,
        )
        recommendations = " ".join(result["recommendations"]).lower()
        self.assertIn("sepsis", recommendations)
        self.assertIn("oxygenation", recommendations)
