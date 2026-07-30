export type MortalityTier = "Low" | "Moderate" | "High";

export type Outcome28d = "unknown" | "survived" | "deceased";

export interface MaternalProfile {
  id: number;
  hospital_mrn: string;
  full_name: string;
  age: number | null;
  blood_group: string;
  hiv_status: string;
  gravida: number;
  parity: number;
  gestational_diabetes: boolean;
  hypertension: boolean;
  anc_visits: number;
  created_at: string;
}

export interface Patient {
  id: number;
  patient_code: string;
  display_name?: string;
  gender: string;
  birth_weight: number;
  current_weight?: number | null;
  gestational_age: number;
  gestational_age_days?: number;
  mother_age: number;
  outcome_28d?: Outcome28d;
  pod?: number | null;
  pod_name?: string | null;
  bed_number?: string;
  delivery_type?: string;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  apgar_1min_components?: Record<string, number> | null;
  apgar_5min_components?: Record<string, number> | null;
  status?: "active" | "discharged" | "transferred" | "deceased";
  admission_date?: string;
  /** Staff who completed admission (nurse or doctor). */
  admitted_by_name?: string | null;
  admitted_by_role?: string | null;
  admitted_by_username?: string | null;
  maternal?: MaternalProfile | null;
  risk_level?: string;
  created_at: string;
  latest_assessment?: LatestAssessment | null;
  assessment?: Assessment;
}

export interface PodStaffMember {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface Pod {
  id: number;
  name: string;
  description: string;
  bed_capacity: number;
  is_active: boolean;
  staff_count: number;
  occupied_beds?: number;
  available_beds?: number;
  /** Active bed labels in this POD (normalized), for conflict checks. */
  occupied_bed_labels?: { bed: string; patient_code: string }[];
  staff: PodStaffMember[];
  created_at: string;
  updated_at: string;
}

export interface ClinicalAwarenessScore {
  probability?: number;
  tier: MortalityTier;
  label?: string;
  score?: number;
  factors?: string[];
}

export interface ClinicalAwareness {
  baseline: ClinicalAwarenessScore;
  current_estimate: ClinicalAwarenessScore;
  acuity: ClinicalAwarenessScore;
  trajectory: {
    direction: "baseline" | "improving" | "stable" | "worsening";
    probability_delta: number;
    acuity_delta: number;
    vs_baseline_delta: number;
    message: string;
    improved_factors?: string[];
    worsened_factors?: string[];
  };
  factors: {
    fixed: string[];
    modifiable: string[];
    neutral: string[];
  };
  awareness_note: string;
}

export interface LatestAssessment {
  id: number;
  gestational_age?: number;
  birth_weight?: number;
  current_weight?: number | null;
  mortality_probability: number;
  mortality_tier: MortalityTier;
  mortality_factors: string[];
  model_used?: string;
  model_confidence: number;
  intervention_window: string;
  ai_summary: string;
  ai_recommendations: string[];
  ai_differentials: string[];
  created_at: string;
  clinical_awareness?: ClinicalAwareness;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  temperature?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  blood_glucose?: number | null;
  sepsis?: boolean;
  respiratory_distress_syndrome?: boolean;
  birth_asphyxia?: boolean;
  respiratory_distress_grade?: "None" | "Mild" | "Moderate" | "Severe";
  birth_asphyxia_grade?: "None" | "Mild" | "Moderate" | "Severe";
  multiple_birth?: boolean;
}

export interface Assessment extends LatestAssessment {
  patient: number;
  patient_code: string;
  birth_weight: number;
  current_weight?: number | null;
  gestational_age: number;
  mother_age: number;
  gender: string;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  temperature?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  model_used?: string;
}

export interface Alert {
  id: number;
  patient: number;
  patient_code: string;
  assessment: number | null;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_patients: number;
  mortality_distribution: Record<MortalityTier, number>;
  avg_mortality_probability: number;
  avg_model_confidence: number;
  predictions_today: number;
  trend: Array<{ day: string; high: number; medium: number; low: number }>;
  recent_patients: Array<{
    id: number;
    patient_code: string;
    birth_weight: number;
    gestational_age: number;
    mortality_probability: number;
    mortality_tier: MortalityTier;
  }>;
  high_mortality_patients: Array<{
    id: number;
    patient_code: string;
    birth_weight: number;
    gestational_age: number;
    mortality_probability: number;
    mortality_tier: MortalityTier;
    intervention_window: string;
  }>;
  unacknowledged_alerts: number;
  recent_alerts: Array<{
    id: number;
    patient_code: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    acknowledged: boolean;
    created_at: string;
  }>;
  recent_assessments: Array<{
    id: number;
    patient_code: string;
    mortality_probability: number;
    mortality_tier: MortalityTier;
    model_confidence: number;
    created_at: string;
  }>;
}

export interface AssessmentFormData {
  patient_code: string;
  gender: string;
  birth_weight: number;
  current_weight?: number;
  gestational_age: number;
  mother_age: number;
  apgar_1min?: number;
  apgar_5min?: number;
  apgar_1min_components?: Record<string, number> | null;
  apgar_5min_components?: Record<string, number> | null;
  clinical_status?: "healthy" | "moderate" | "severe";
  risk_flags?: string[];
  temperature?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  spo2?: number;
  blood_glucose: number;
  sepsis?: boolean;
  respiratory_distress_grade?: "None" | "Mild" | "Moderate" | "Severe";
  birth_asphyxia_grade?: "None" | "Mild" | "Moderate" | "Severe";
  respiratory_distress_syndrome?: boolean;
  birth_asphyxia?: boolean;
  multiple_birth?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TeamMessage {
  pod_name?: string;
  id: number;
  channel: string;
  body: string;
  patient_code: string;
  sender_username: string;
  sender_name: string;
  sender_role: string;
  /** Profile photo data URL when the sender has uploaded one. */
  sender_avatar?: string;
  recipient_username?: string | null;
  recipient_name?: string;
  is_broadcast: boolean;
  created_at: string;
  /** Soft-deleted for everyone (WhatsApp-style). */
  is_deleted?: boolean;
  can_delete_for_everyone?: boolean;
  /** Sender-only: sent | delivered | seen */
  delivery_status?: "sent" | "delivered" | "seen" | null;
}

/** @deprecated Use MortalityTier */
export type RiskLevel = "Low" | "Medium" | "High";
