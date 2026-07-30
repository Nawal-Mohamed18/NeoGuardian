export const ROLE_BADGE_CLASS: Record<string, string> = {
  nurse: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  doctor: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  admin: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

export const ROLE_LABEL: Record<string, string> = {
  nurse: "Nurse",
  doctor: "Doctor",
  admin: "Administrator",
};

export const ROLE_TITLE: Record<string, string> = {
  nurse: "NICU Nurse",
  doctor: "Neonatologist",
  admin: "System Administrator",
};

export function formatLastLogin(iso?: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function displayWard(ward?: string, role?: string) {
  if (role === "admin" || !ward) return "—";
  return ward;
}

export function staffInitials(fullName?: string, username?: string) {
  const source = (fullName || username || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function accountStatus(user: { is_active?: boolean }) {
  if (user.is_active === false) return { label: "Deactivated", className: "bg-amber-50 text-amber-700" };
  return { label: "Active", className: "bg-emerald-50 text-emerald-700" };
}
