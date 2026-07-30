export interface SystemHealth {
  status: string;
  timestamp: string;
  database: string;
  database_file?: string;
  model_path?: string;
  model_loaded?: boolean;
  model_version?: string;
  model_test_auc?: number | null;
  ai_mode?: string;
  counts: Record<string, number>;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_active?: boolean;
  role?: string;
  profile?: {
    role: string;
    full_name: string;
    title: string;
    hospital: string;
    ward?: string;
    wards?: string[];
    preferences?: import("@/lib/userPreferences").UserPreferences;
  };
  last_login?: string | null;
  date_joined?: string;
  /** ISO timestamp of last presence heartbeat (chat online status). */
  last_seen_at?: string | null;
  /** True when last_seen_at is within the server online window. */
  is_online?: boolean;
}

export interface AdminSystemStats {
  users: number;
  doctors: number;
  nurses: number;
  admins: number;
  patients: number;
  patients_active: number;
  patients_discharged: number;
  patients_transferred: number;
  wards: number;
  maternal_profiles: number;
  alerts_active: number;
  predictions_today: number;
  predictions_total: number;
  average_risk_score: number;
  audit_logs: number;
  uptime_status: string;
  last_sync: string;
}

export interface AnalyticsDashboard {
  total_patients: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  predictions_today: number;
  active_alerts: number;
  risk_distribution: Array<{ name: string; value: number; fill: string }>;
}

export interface RiskTrendPoint {
  date: string;
  high: number;
  medium: number;
  low: number;
}

export interface PodStat {
  ward: string;
  ward_id: number;
  total: number;
  capacity: number;
  available: number;
  occupancy_pct: number;
  high: number;
  nurses_assigned: number;
  doctors_assigned: number;
  is_full: boolean;
}

export interface OutcomeTrendPoint {
  date: string;
  avg_hr: number | null;
  avg_spo2: number | null;
}

export interface AlertSummary {
  critical: number;
  warning: number;
  info?: number;
  total_active: number;
  high_risk_patients: number;
  medium_risk_patients: number;
  low_risk_patients: number;
  total_patients: number;
}
