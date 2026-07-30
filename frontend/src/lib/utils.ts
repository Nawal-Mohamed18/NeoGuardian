import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clear date + time for clinical timestamps (alerts, assessments). */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Map staff role codes to display labels. */
export function formatStaffRole(role?: string | null): string | null {
  if (!role) return null;
  if (role === "nurse") return "Nurse";
  if (role === "doctor") return "Doctor";
  if (role === "admin") return "Admin";
  return role;
}

/** e.g. "Admitted by Sara Ahmed · Nurse" */
export function formatAdmittedBy(
  name?: string | null,
  role?: string | null,
  opts?: { prefix?: string }
): string | null {
  if (!name) return null;
  const prefix = opts?.prefix ?? "Admitted by";
  const roleLabel = formatStaffRole(role);
  return roleLabel ? `${prefix} ${name} · ${roleLabel}` : `${prefix} ${name}`;
}
