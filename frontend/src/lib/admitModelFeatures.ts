/**
 * Separation boundary for Admit Newborn:
 * - Registration data: identity / POD / bed / gravida / parity (NOT model input)
 * - AI model features: synthetic Balanced RF clinical subset only
 */

import type { AdmitPatientPayload } from "@/lib/api";
import type { ApgarComponents } from "@/lib/apgar";
import { sumApgar } from "@/lib/apgar";
import { parseOptionalNumber } from "@/lib/clinicalValidation";

export type SeverityGrade = "None" | "Mild" | "Moderate" | "Severe";

/** Administrative / identity fields stored on the patient record — not model input. */
export type AdmitRegistrationFields = Pick<
  AdmitPatientPayload,
  | "hospital_mrn"
  | "mother_name"
  | "display_name"
  | "pod_id"
  | "bed_number"
  | "blood_group"
  | "hiv_status"
  | "gravida"
  | "parity"
>;

/**
 * Clinical fields that feed the risk model (train_meta.joblib feature set).
 * Identifiers, POD/bed, MRN, names, gravida/parity are excluded.
 */
export type AdmitAiModelFields = Pick<
  AdmitPatientPayload,
  | "mother_age"
  | "anc_visits"
  | "gestational_diabetes"
  | "hypertension"
  | "prolonged_rupture_of_membranes"
  | "gender"
  | "birth_weight_grams"
  | "gestational_age_weeks"
  | "gestational_age_days"
  | "apgar_1min"
  | "apgar_5min"
  | "apgar_1min_components"
  | "apgar_5min_components"
  | "delivery_type"
  | "multiple_birth"
  | "heart_rate"
  | "spo2"
  | "respiratory_rate"
  | "temperature"
  | "blood_glucose"
  | "sepsis"
  | "respiratory_distress_grade"
  | "birth_asphyxia_grade"
  | "respiratory_distress_syndrome"
  | "birth_asphyxia"
>;

export function buildAdmitRegistrationFields(input: {
  hospital_mrn: string;
  mother_name: string;
  pod_id: string;
  bed_number: string;
  gravida: string;
  parity: string;
}): AdmitRegistrationFields {
  const mother = input.mother_name.trim();
  return {
    hospital_mrn: input.hospital_mrn.trim(),
    mother_name: mother,
    display_name: `${mother}'s baby`,
    pod_id: Number(input.pod_id),
    bed_number: input.bed_number.trim(),
    blood_group: "O+",
    hiv_status: "Non-reactive (Negative)",
    gravida: Number(input.gravida || 1),
    parity: Number(input.parity || 0),
  };
}

/** Extract only approved clinical features from wizard state for the admit API. */
export function buildAdmitAiModelFeatures(input: {
  mother_age: string;
  anc_visits: string;
  gestational_diabetes: boolean;
  hypertension: boolean;
  prolonged_rupture_of_membranes: boolean;
  gender: string;
  birth_weight_grams: string;
  gestational_age_weeks: string;
  apgar_1min_components: ApgarComponents;
  apgar_5min_components: ApgarComponents;
  delivery_type: string;
  multiple_birth: boolean;
  heart_rate: string;
  spo2: string;
  respiratory_rate: string;
  temperature: string;
  blood_glucose: string;
  sepsis: boolean;
  respiratory_distress_grade: SeverityGrade;
  birth_asphyxia_grade: SeverityGrade;
}): AdmitAiModelFields {
  const a1 = sumApgar(input.apgar_1min_components);
  const a5 = sumApgar(input.apgar_5min_components);
  const rds = input.respiratory_distress_grade;
  const asphyxia = input.birth_asphyxia_grade;
  return {
    mother_age: Number(input.mother_age),
    anc_visits: Number(input.anc_visits || 0),
    gestational_diabetes: input.gestational_diabetes,
    hypertension: input.hypertension,
    prolonged_rupture_of_membranes: input.prolonged_rupture_of_membranes,
    gender: input.gender,
    birth_weight_grams: Number(input.birth_weight_grams),
    gestational_age_weeks: Number(input.gestational_age_weeks),
    gestational_age_days: 0,
    apgar_1min: a1,
    apgar_5min: a5,
    apgar_1min_components: input.apgar_1min_components,
    apgar_5min_components: input.apgar_5min_components,
    delivery_type: input.delivery_type,
    multiple_birth: input.multiple_birth,
    heart_rate: parseOptionalNumber(input.heart_rate),
    spo2: parseOptionalNumber(input.spo2),
    respiratory_rate: parseOptionalNumber(input.respiratory_rate),
    temperature: parseOptionalNumber(input.temperature),
    blood_glucose: Number(input.blood_glucose),
    sepsis: input.sepsis,
    respiratory_distress_grade: rds,
    birth_asphyxia_grade: asphyxia,
    respiratory_distress_syndrome: rds !== "None",
    birth_asphyxia: asphyxia !== "None",
  };
}

/**
 * Final admit payload: registration + clinical features (kept as separate objects upstream).
 * Prediction runs server-side after save, using a further-filtered model mapping.
 */
export function buildAdmitRequestPayload(
  registration: AdmitRegistrationFields,
  modelFeatures: AdmitAiModelFields
): AdmitPatientPayload {
  return {
    ...registration,
    ...modelFeatures,
    run_assessment: true,
  };
}
