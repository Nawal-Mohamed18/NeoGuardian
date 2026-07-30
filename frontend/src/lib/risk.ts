import { normalizeMortalityTier } from "@/lib/roles";
import type { MortalityTier, Patient } from "@/types";

/** Fallback display % when only a rules-based tier exists (no ML probability). */
export const TIER_PROBABILITY: Record<MortalityTier, number> = {
  Low: 2.5,
  Moderate: 10,
  High: 22,
};

/** Display / list priority: High first, then Moderate, then Low. */
export const TIER_PRIORITY: Record<MortalityTier, number> = {
  High: 0,
  Moderate: 1,
  Low: 2,
};

/** Same thresholds as backend `tier_from_probability` (model % → tier). */
/** Bands: ≤15 Low, ≤30 Moderate, >30 High. */
export const HIGH_PROBABILITY_THRESHOLD = 30;
export const MODERATE_PROBABILITY_THRESHOLD = 15;

export function tierFromProbability(probability: number): MortalityTier {
  if (probability > HIGH_PROBABILITY_THRESHOLD) return "High";
  if (probability > MODERATE_PROBABILITY_THRESHOLD) return "Moderate";
  return "Low";
}

/**
 * Keep tier badge and percentage in sync everywhere.
 * When a model probability is present, tier is derived from it (not the reverse).
 */
export function alignMortalityRisk(
  tier: MortalityTier | string,
  probability?: number
): { tier: MortalityTier; probability: number } {
  if (typeof probability === "number" && !Number.isNaN(probability)) {
    const rounded = Number(formatRiskPercent(probability));
    return {
      tier: tierFromProbability(rounded),
      probability: rounded,
    };
  }
  const normalized = normalizeMortalityTier(tier);
  return {
    tier: normalized,
    probability: TIER_PROBABILITY[normalized],
  };
}

/** Half-up to 1 decimal — matches care-note / backend `format_risk_pct`. */
export function formatRiskPercent(probability: number, digits = 1): string {
  // Half-up (matches backend format_risk_pct) so 76.85 → "76.9"
  const factor = 10 ** digits;
  const n = Number(probability);
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  const scaled = n * factor;
  const rounded = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  return (rounded / factor).toFixed(digits);
}

/** Clinical weights / vitals: always one decimal place. */
export function formatClinicalNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const factor = 10 ** digits;
  const n = Number(value);
  const scaled = n * factor;
  const rounded = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  return (rounded / factor).toFixed(digits);
}

/** Sort patients High → Moderate → Low, then by higher probability. */
export function comparePatientsByRisk(a: Patient, b: Patient): number {
  const ra = a.latest_assessment
    ? alignMortalityRisk(
        a.latest_assessment.mortality_tier,
        a.latest_assessment.mortality_probability
      )
    : { tier: "Low" as MortalityTier, probability: 0 };
  const rb = b.latest_assessment
    ? alignMortalityRisk(
        b.latest_assessment.mortality_tier,
        b.latest_assessment.mortality_probability
      )
    : { tier: "Low" as MortalityTier, probability: 0 };
  const byTier = TIER_PRIORITY[ra.tier] - TIER_PRIORITY[rb.tier];
  if (byTier !== 0) return byTier;
  return rb.probability - ra.probability;
}
