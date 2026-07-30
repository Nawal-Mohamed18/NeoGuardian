import type { Capability, Role } from "@/lib/roles";
import type { SettingsSectionId } from "@/lib/userPreferences";

export const CAPABILITY_DETAILS: Record<
  Capability,
  { label: string; description: string }
> = {
  "assessment.create": {
    label: "Run assessments",
    description: "Admit newborns and complete NICU risk assessments.",
  },
  "alert.acknowledge": {
    label: "Acknowledge alerts",
    description: "Clear high and moderate risk notifications from the queue.",
  },
  "ai.use": {
    label: "AI clinical guidance",
    description: "View AI summaries, recommendations, and patient chat.",
  },
  "phi.view": {
    label: "View patient identifiers",
    description: "See full newborn codes and clinical identifiers (not masked).",
  },
  "user.manage": {
    label: "Manage staff accounts",
    description: "Create, update, and deactivate hospital user accounts.",
  },
  "system.manage": {
    label: "System administration",
    description: "Access platform health, model status, and system tools.",
  },
};

export const MODULE_LABELS: Record<string, string> = {
  "/": "Clinical overview",
  "/my-patients": "My patients",
  "/ai-center": "AI center & assessments",
  "/newborns": "Patient registry",
  "/notifications": "Alerts inbox",
  "/chat": "Team chat",
  "/reports": "Clinical reports",
  "/settings": "Account settings",
  "/users": "Staff directory",
  "/pods": "Manage PODs",
};

export const WARD_OPTIONS = ["", "NICU Pod A", "NICU Pod B", "NICU Pod C"] as const;

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  roles: Role[] | "all";
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Name, contact, and ward assignment",
    roles: "all",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and display density",
    roles: "all",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alert and inbox preferences",
    roles: "all",
  },
  {
    id: "security",
    label: "Security",
    description: "Password and session",
    roles: "all",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Dashboard and workflow defaults",
    roles: "all",
  },
  {
    id: "access",
    label: "Access & permissions",
    description: "What your role can do in NeoGuardian",
    roles: "all",
  },
];

export function sectionsForRole(role: Role): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => s.roles === "all" || s.roles.includes(role));
}
