/**
 * Shared clinical validation ranges for admit + reassess forms.
 * Backend may be slightly stricter/looser; these drive friendly frontend messages.
 */

export const CLINICAL_RANGES = {
  temperature_c: { min: 32, max: 42, unit: "°C", label: "Temperature" },
  heart_rate: { min: 40, max: 250, unit: "bpm", label: "Heart rate" },
  respiratory_rate: { min: 5, max: 120, unit: "/min", label: "Respiratory rate" },
  spo2: { min: 0, max: 100, unit: "%", label: "SpO₂" },
  blood_glucose: { min: 10, max: 600, unit: "mg/dL", label: "Blood glucose" },
  gestational_age_weeks: { min: 20, max: 45, unit: "weeks", label: "Gestational age" },
  birth_weight_grams: { min: 300, max: 7000, unit: "g", label: "Birth weight" },
  birth_weight_kg: { min: 0.3, max: 7.0, unit: "kg", label: "Birth weight" },
  current_weight_kg: { min: 0.3, max: 8.0, unit: "kg", label: "Current weight" },
  mother_age: { min: 12, max: 60, unit: "years", label: "Mother age" },
  anc_visits: { min: 0, max: 40, unit: "", label: "Antenatal visits" },
  apgar: { min: 0, max: 10, unit: "", label: "Apgar" },
} as const;

export type ClinicalRangeKey = keyof typeof CLINICAL_RANGES;

/** Empty string / null / undefined count as “not provided”. */
export function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateRange(
  value: unknown,
  key: ClinicalRangeKey,
  opts?: { required?: boolean }
): string {
  const range = CLINICAL_RANGES[key];
  if (isBlank(value)) {
    return opts?.required ? `${range.label} is required.` : "";
  }
  const n = parseOptionalNumber(value);
  if (n == null) return `${range.label} must be a number.`;
  if (n < range.min || n > range.max) {
    const unit = range.unit ? ` ${range.unit}` : "";
    return `${range.label} must be between ${range.min} and ${range.max}${unit}.`;
  }
  return "";
}
