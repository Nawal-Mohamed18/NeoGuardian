"""Clinical risk stratification entry point (Low / Moderate / High)."""

from .risk_engine import calculate_risk, predict_mortality

__all__ = ["calculate_risk", "predict_mortality"]
