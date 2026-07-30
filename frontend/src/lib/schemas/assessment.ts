import { z } from "zod";
import type { AssessmentFormData } from "@/types";
import { CLINICAL_RANGES } from "@/lib/clinicalValidation";

const optionalNumber = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)))
  .optional()
  .refine(
    (v) => v === undefined || !Number.isNaN(v),
    { message: "Must be a number" }
  );

const requiredGlucose = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === undefined || v === null ? NaN : Number(v)))
  .refine((v) => !Number.isNaN(v), { message: "Blood glucose is required (model feature)." })
  .refine(
    (v) => v >= CLINICAL_RANGES.blood_glucose.min && v <= CLINICAL_RANGES.blood_glucose.max,
    {
      message: `Blood glucose must be between ${CLINICAL_RANGES.blood_glucose.min} and ${CLINICAL_RANGES.blood_glucose.max} mg/dL`,
    }
  );

const optionalTemp = optionalNumber.refine(
  (v) =>
    v === undefined ||
    (v >= CLINICAL_RANGES.temperature_c.min && v <= CLINICAL_RANGES.temperature_c.max),
  {
    message: `Temperature must be between ${CLINICAL_RANGES.temperature_c.min} and ${CLINICAL_RANGES.temperature_c.max} °C`,
  }
);

const optionalHr = optionalNumber.refine(
  (v) =>
    v === undefined ||
    (v >= CLINICAL_RANGES.heart_rate.min && v <= CLINICAL_RANGES.heart_rate.max),
  {
    message: `Heart rate must be between ${CLINICAL_RANGES.heart_rate.min} and ${CLINICAL_RANGES.heart_rate.max} bpm`,
  }
);

const optionalRr = optionalNumber.refine(
  (v) =>
    v === undefined ||
    (v >= CLINICAL_RANGES.respiratory_rate.min && v <= CLINICAL_RANGES.respiratory_rate.max),
  {
    message: `Respiratory rate must be between ${CLINICAL_RANGES.respiratory_rate.min} and ${CLINICAL_RANGES.respiratory_rate.max} /min`,
  }
);

const optionalSpo2 = optionalNumber.refine(
  (v) =>
    v === undefined || (v >= CLINICAL_RANGES.spo2.min && v <= CLINICAL_RANGES.spo2.max),
  {
    message: `SpO₂ must be between ${CLINICAL_RANGES.spo2.min} and ${CLINICAL_RANGES.spo2.max}%`,
  }
);

const severityGrade = z.enum(["None", "Mild", "Moderate", "Severe"]).default("None");

/** Reassess form: bedside/change fields only. Admit demographics come from the patient record. */
export const assessmentSchema = z.object({
  patient_code: z.string().min(1, "Patient code required"),
  // Carried from patient for API/DB snapshot — not assessment-model inputs.
  gender: z.enum(["Male", "Female"]).optional(),
  mother_age: optionalNumber,
  birth_weight: optionalNumber,
  gestational_age: optionalNumber,
  current_weight: optionalNumber.refine(
    (v) =>
      v === undefined ||
      (v >= CLINICAL_RANGES.current_weight_kg.min && v <= CLINICAL_RANGES.current_weight_kg.max),
    {
      message: `Current weight must be between ${CLINICAL_RANGES.current_weight_kg.min} and ${CLINICAL_RANGES.current_weight_kg.max} kg`,
    }
  ),
  apgar_1min: optionalNumber,
  apgar_5min: optionalNumber,
  apgar_1min_components: z.record(z.string(), z.number()).optional().nullable(),
  apgar_5min_components: z.record(z.string(), z.number()).optional().nullable(),
  temperature: optionalTemp,
  heart_rate: optionalHr,
  spo2: optionalSpo2,
  respiratory_rate: optionalRr,
  blood_glucose: requiredGlucose,
  sepsis: z.boolean().optional().default(false),
  respiratory_distress_grade: severityGrade,
  birth_asphyxia_grade: severityGrade,
  respiratory_distress_syndrome: z.boolean().optional().default(false),
  birth_asphyxia: z.boolean().optional().default(false),
  multiple_birth: z.boolean().optional().default(false),
});

export type AssessmentFormValues = z.infer<typeof assessmentSchema>;

export function toAssessmentPayload(values: AssessmentFormValues): AssessmentFormData {
  const rdsGrade = values.respiratory_distress_grade ?? "None";
  const asphGrade = values.birth_asphyxia_grade ?? "None";
  const payload: AssessmentFormData = {
    patient_code: values.patient_code,
    gender: values.gender ?? "Female",
    mother_age: values.mother_age ?? 0,
    birth_weight: values.birth_weight ?? 0,
    gestational_age: values.gestational_age ?? 0,
    clinical_status:
      values.sepsis || rdsGrade !== "None" || asphGrade !== "None" ? "severe" : "healthy",
    risk_flags: [
      ...(values.sepsis ? ["sepsis_suspicion"] : []),
      ...(rdsGrade !== "None" ? ["respiratory_distress_syndrome"] : []),
      ...(asphGrade !== "None" ? ["birth_asphyxia"] : []),
    ],
    apgar_1min: values.apgar_1min,
    apgar_5min: values.apgar_5min,
    apgar_1min_components: values.apgar_1min_components ?? null,
    apgar_5min_components: values.apgar_5min_components ?? null,
    temperature: values.temperature,
    heart_rate: values.heart_rate,
    spo2: values.spo2,
    respiratory_rate: values.respiratory_rate,
    blood_glucose: values.blood_glucose,
    sepsis: values.sepsis ?? false,
    respiratory_distress_grade: rdsGrade,
    birth_asphyxia_grade: asphGrade,
    respiratory_distress_syndrome: rdsGrade !== "None",
    birth_asphyxia: asphGrade !== "None",
    multiple_birth: values.multiple_birth ?? false,
  };
  if (values.current_weight != null && !Number.isNaN(values.current_weight)) {
    payload.current_weight = values.current_weight;
  }
  return payload;
}
