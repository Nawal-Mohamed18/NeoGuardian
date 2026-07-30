// Role-based access — each user has one role from login (no switching in-app).

export type Role = "admin" | "nurse" | "doctor";

export type Capability =
  | "assessment.create"
  | "alert.acknowledge"
  | "ai.use"
  | "user.manage"
  | "system.manage"
  | "phi.view";

export interface RoleConfig {
  key: Role;
  label: string;
  description: string;
  landing: string;
  modules: string[] | "*";
  capabilities: Capability[];
}

/** Clinical modules without All Patients list or New Assessment sidenav entry. */
const CLINICAL_MODULES = [
  "/",
  "/newborns",
  "/newborns/register",
  "/my-patients",
  "/ai-center",
  "/notifications",
  "/chat",
  "/reports",
  "/settings",
];

export const ROLES: Record<Role, RoleConfig> = {
  doctor: {
    key: "doctor",
    label: "Doctor",
    description: "Runs new assessments and gives care instructions to the team.",
    landing: "/",
    modules: CLINICAL_MODULES,
    capabilities: ["assessment.create", "alert.acknowledge", "ai.use", "phi.view"],
  },
  nurse: {
    key: "nurse",
    label: "Nurse",
    description: "Runs admission assessments, monitors patients, and acknowledges alerts.",
    landing: "/",
    modules: CLINICAL_MODULES,
    capabilities: ["assessment.create", "alert.acknowledge", "ai.use", "phi.view"],
  },
  admin: {
    key: "admin",
    label: "Admin",
    description: "Staff management and hospital operations.",
    landing: "/",
    modules: ["/", "/notifications", "/users", "/pods", "/chat", "/newborns", "/patients", "/reports", "/settings"],
    capabilities: ["user.manage", "system.manage", "alert.acknowledge", "phi.view"],
  },
};

export const ROLE_LIST: RoleConfig[] = Object.values(ROLES);

export const DEFAULT_ROLE: Role = "doctor";

const LEGACY_ROLE_MAP: Record<string, Role> = {
  neonatologist: "doctor",
  developer: "admin",
  researcher: "admin",
  midwife: "nurse",
  lab_tech: "nurse",
  pharmacist: "nurse",
};

export function isRole(value: string | null | undefined): value is Role {
  return !!value && value in ROLES;
}

export function normalizeRole(value: string | null | undefined): Role | null {
  if (isRole(value)) return value;
  if (value && value in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[value];
  return null;
}

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLES[role].capabilities.includes(capability);
}

export function isModuleAllowed(role: Role, href: string): boolean {
  const modules = ROLES[role].modules;
  if (modules === "*") return true;
  if (modules.includes(href)) return true;
  return modules.some((m) => m !== "/" && (href === m || href.startsWith(`${m}/`)));
}

export function canViewPHI(role: Role): boolean {
  return hasCapability(role, "phi.view");
}

export function maskName(name: string, code: string, allowed: boolean): string {
  if (allowed) return name;
  const suffix = code.replace(/[^0-9]/g, "").slice(-4) || "••••";
  return `Newborn ${suffix}`;
}

export function normalizeMortalityTier(tier: string): "Low" | "Moderate" | "High" {
  if (tier === "High" || tier === "Critical") return "High";
  if (tier === "Moderate" || tier === "Medium") return "Moderate";
  return "Low";
}
