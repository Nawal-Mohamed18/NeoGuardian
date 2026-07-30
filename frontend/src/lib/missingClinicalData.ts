import { isBlank, parseOptionalNumber } from "@/lib/clinicalValidation";

/** Clinical inputs that affect interpretation when omitted (UI transparency). */
export type ClinicalSnapshot = {
  blood_glucose?: number | string | null;
  temperature?: number | string | null;
  spo2?: number | string | null;
  respiratory_rate?: number | string | null;
  heart_rate?: number | string | null;
};

export type MissingClinicalField = {
  key: keyof ClinicalSnapshot;
  label: string;
};

const WATCHED: MissingClinicalField[] = [
  { key: "blood_glucose", label: "Blood glucose" },
  { key: "temperature", label: "Temperature" },
  { key: "spo2", label: "SpO₂" },
  { key: "respiratory_rate", label: "Respiratory rate" },
  { key: "heart_rate", label: "Heart rate" },
];

export function listMissingClinicalFields(snapshot: ClinicalSnapshot): MissingClinicalField[] {
  return WATCHED.filter((field) => {
    const raw = snapshot[field.key];
    return isBlank(raw) || parseOptionalNumber(raw) == null;
  });
}

export function hasIncompleteClinicalData(snapshot: ClinicalSnapshot): boolean {
  return listMissingClinicalFields(snapshot).length > 0;
}

export const INCOMPLETE_DATA_MESSAGE =
  "Prediction generated using incomplete clinical information.";
