/**
 * In-product model disclosure.
 * Admit and reassess use different Balanced RF packages.
 */

export const MODEL_INFORMATION = {
  title: "Model Information",
  modelName: "Balanced Random Forest",
  version: "balanced_random_forest",
  purpose: "Prototype clinical decision-support for 28-day neonatal mortality risk.",
  training: "Synthetic neonatal dataset (cleaner → birth-weight cats → scaler → BRF).",
  status: "Research Prototype",
  clinicalUse: "Not approved for independent clinical decision making.",
  judgmentNote: "Prediction should support—not replace—clinical judgment.",
} as const;

export const ASSESSMENT_MODEL_INFORMATION = {
  ...MODEL_INFORMATION,
  modelName: "Assessment Balanced Random Forest",
  version: "assessment_balanced_rf",
  purpose: "Bedside reassess risk from current weight, vitals, and complications only.",
  training:
    "Synthetic reassess dataset (no admit-only fields: GA, birth weight, sex, day of life).",
} as const;

export type ModelInformation = typeof MODEL_INFORMATION;

export function resolveModelInformation(runtimeModelUsed?: string | null): ModelInformation {
  const id = (runtimeModelUsed || "").toLowerCase();
  if (id.includes("assessment")) return ASSESSMENT_MODEL_INFORMATION;
  return MODEL_INFORMATION;
}
