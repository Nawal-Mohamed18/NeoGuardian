import axios from "axios";
import type {
  Alert,
  Assessment,
  AssessmentFormData,
  DashboardStats,
  Patient,
  Pod,
  TeamMessage,
} from "@/types";
import type { SystemHealth, AuthUser, AdminSystemStats, AnalyticsDashboard, RiskTrendPoint, PodStat, OutcomeTrendPoint, AlertSummary } from "@/types/clinical";
import type { Role } from "@/lib/roles";
import { normalizeRole } from "@/lib/roles";

const TOKEN_KEY = "ng_access_token";
const REFRESH_KEY = "ng_refresh_token";
const AUTH_KEY = "ng_authed";
const USERNAME_KEY = "ng_username";
const USER_KEY = "ng_user";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/",
});

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasValidSession(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === "true" && !!getAccessToken();
  } catch {
    return false;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");
    const isLoginCall = url.includes("auth/login");
    // Any 401 (including GET) means the session is invalid — force re-login.
    if (status === 401 && !isLoginCall) {
      clearTokens();
      try {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem("ng_role");
      } catch {
        /* ignore */
      }
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?session=expired";
      }
    }
    return Promise.reject(error);
  }
);

export function storeTokens(access: string, refresh: string, username?: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(AUTH_KEY, "true");
  if (username) localStorage.setItem(USERNAME_KEY, username);
}

export function storeUser(user: AuthUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore storage errors */
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(USER_KEY);
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access: string; refresh: string; role: string; user: AuthUser }>(
      "auth/login/",
      { username, password }
    ).then((r) => r.data),
  me: () => api.get<AuthUser>("auth/me/").then((r) => r.data),
  updateMe: (data: {
    email?: string;
    full_name?: string;
    ward?: string;
    preferences?: Record<string, boolean | string>;
  }) => api.patch<AuthUser>("auth/me/", data).then((r) => r.data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post<{ detail: string }>("auth/change-password/", data).then((r) => r.data),
  clinicalStaff: () => api.get<AuthUser[]>("auth/clinical-staff/").then((r) => r.data),
  heartbeat: () => api.post<AuthUser>("auth/heartbeat/").then((r) => r.data),
  users: (group?: "clinical" | "admin" | "all") =>
    api
      .get<AuthUser[]>("auth/users/", { params: group && group !== "all" ? { group } : {} })
      .then((r) => r.data),
  createUser: (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    hospital?: string;
    role: Role;
    ward?: string;
  }) => api.post<AuthUser>("auth/users/create/", data).then((r) => r.data),
  updateUser: (
    id: number,
    data: {
      role?: Role;
      is_active?: boolean;
      full_name?: string;
      hospital?: string;
      ward?: string;
      password?: string;
    }
  ) => api.patch<AuthUser>(`auth/users/${id}/`, data).then((r) => r.data),
  deleteUser: (id: number) => api.delete(`auth/users/${id}/`),
};

export type AdmitPatientPayload = {
  hospital_mrn?: string;
  mother_name: string;
  mother_age: number;
  blood_group?: string;
  hiv_status?: string;
  gravida?: number;
  parity?: number;
  gestational_diabetes?: boolean;
  hypertension?: boolean;
  anc_visits?: number;
  display_name?: string;
  gender: string;
  birth_weight_grams: number;
  gestational_age_weeks: number;
  gestational_age_days?: number;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  apgar_1min_components?: Record<string, number> | null;
  apgar_5min_components?: Record<string, number> | null;
  delivery_type?: string;
  pod_id?: number | null;
  bed_number?: string;
  current_weight_grams?: number | null;
  run_assessment?: boolean;
  heart_rate?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  respiratory_support?: string;
  feeding_difficulty?: boolean;
  complication_type?: string;
  blood_glucose: number;
  sepsis?: boolean;
  prolonged_rupture_of_membranes?: boolean;
  respiratory_distress_syndrome?: boolean;
  birth_asphyxia?: boolean;
  respiratory_distress_grade?: "None" | "Mild" | "Moderate" | "Severe";
  birth_asphyxia_grade?: "None" | "Mild" | "Moderate" | "Severe";
  multiple_birth?: boolean;
};

export const patientApi = {
  list: (params?: { search?: string; status?: string; pod?: number }) =>
    api.get<Patient[]>("patients/", { params }).then((r) => r.data),
  get: (id: number) => api.get<Patient>(`patients/${id}/`).then((r) => r.data),
  create: (data: {
    patient_code: string;
    gender: string;
    birth_weight: number;
    gestational_age: number;
    mother_age: number;
  }) => api.post<Patient>("patients/", data).then((r) => r.data),
  admit: (data: AdmitPatientPayload) =>
    api.post<Patient>("patients/admit/", data).then((r) => r.data),
  update: (id: number, data: Partial<Patient>) =>
    api.patch<Patient>(`patients/${id}/`, data).then((r) => r.data),
  discharge: (id: number) =>
    api.post<Patient>(`patients/${id}/discharge/`).then((r) => r.data),
  transfer: (id: number, data: { pod_id: number; bed_number?: string }) =>
    api.post<Patient>(`patients/${id}/transfer/`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`patients/${id}/`),
};

export const assessmentApi = {
  list: (patientId?: number) =>
    api
      .get<Assessment[]>("assessments/", { params: patientId ? { patient: patientId } : {} })
      .then((r) => r.data),
  create: (data: AssessmentFormData) =>
    api.post<Assessment>("assessments/", data).then((r) => r.data),
};

export const alertApi = {
  list: () => api.get<Alert[]>("alerts/").then((r) => r.data),
  summary: () => api.get<AlertSummary>("alerts/summary/").then((r) => r.data),
  acknowledge: (id: number) =>
    api.patch<Alert>(`alerts/${id}/acknowledge/`).then((r) => r.data),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("dashboard/stats/").then((r) => r.data),
  health: () => api.get<SystemHealth>("dashboard/health/").then((r) => r.data),
};

export const adminApi = {
  systemStats: () => api.get<AdminSystemStats>("admin/system-stats/").then((r) => r.data),
};

export const analyticsApi = {
  dashboard: () => api.get<AnalyticsDashboard>("analytics/dashboard/").then((r) => r.data),
  riskTrends: (granularity: "day" | "month" = "day") =>
    api
      .get<RiskTrendPoint[]>("analytics/risk-trends/", { params: { granularity } })
      .then((r) => r.data),
  podStats: () => api.get<PodStat[]>("analytics/pod-stats/").then((r) => r.data),
  outcomeTrends: () => api.get<OutcomeTrendPoint[]>("analytics/outcome-trends/").then((r) => r.data),
};

export const teamChatApi = {
  list: () => api.get<TeamMessage[]>("team-chat/").then((r) => r.data),
  send: (data: { body: string; patient_code?: string; pod_name?: string; recipient_username?: string | null }) =>
    api.post<TeamMessage>("team-chat/", data).then((r) => r.data),
  deleteMessage: (id: number, mode: "for_me" | "for_everyone") =>
    api.post<TeamMessage | { id: number; hidden: boolean }>(`team-chat/${id}/delete/`, { mode }).then((r) => r.data),
  markSeen: (data: { conversation_id?: string; message_ids?: number[] }) =>
    api.post<{ seen: number; message_ids: number[] }>("team-chat/mark-seen/", data).then((r) => r.data),
};

export const podApi = {
  list: () => api.get<Pod[]>("pods/").then((r) => r.data),
  create: (data: { name: string; description?: string; bed_capacity?: number; is_active?: boolean }) =>
    api.post<Pod>("pods/", data).then((r) => r.data),
  update: (
    id: number,
    data: Partial<{ name: string; description: string; bed_capacity: number; is_active: boolean }>
  ) => api.patch<Pod>(`pods/${id}/`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`pods/${id}/`),
  assignStaff: (podId: number, userId: number) =>
    api.post<Pod>(`pods/${podId}/assign-staff/`, { user_id: userId }).then((r) => r.data),
  unassignStaff: (podId: number, userId: number) =>
    api.post<Pod>(`pods/${podId}/unassign-staff/`, { user_id: userId }).then((r) => r.data),
};

export const aiApi = {
  predict: (data: AssessmentFormData) =>
    api.post<Assessment>("ai/predict/", data).then((r) => r.data),
  chat: (patientId: number, message: string, history: Array<{ role: string; content: string }>) =>
    api
      .post<{ reply: string; model_used: string }>("ai/chat/", {
        patient_id: patientId,
        message,
        history,
      })
      .then((r) => r.data),
};

export function roleFromAuthUser(user: AuthUser): Role | null {
  const r = user.profile?.role ?? user.role;
  return normalizeRole(r);
}

export default api;
