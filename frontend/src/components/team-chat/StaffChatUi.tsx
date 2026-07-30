import { cn } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { resolveStaffAvatar } from "@/lib/avatarImage";

export const STAFF_CHAT_COLORS = {
  primary: "#14B8A6",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

export const ROLE_BADGE_CLASS: Record<string, string> = {
  doctor: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-700/60 dark:bg-sky-950/70 dark:text-sky-200",
  nurse:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/70 dark:text-emerald-200",
  admin:
    "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-700/60 dark:bg-violet-950/70 dark:text-violet-200",
  broadcast:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/70 dark:text-amber-200",
};

export const ROLE_DOT: Record<string, string> = {
  doctor: "bg-sky-500",
  nurse: "bg-emerald-500",
  admin: "bg-violet-500",
  broadcast: "bg-amber-500",
};

export const ROLE_LABEL: Record<string, string> = {
  doctor: "NICU Doctor",
  nurse: "NICU Nurse",
  admin: "Admin",
  broadcast: "Broadcast",
};

export const PLACEHOLDER: Record<Role, string> = {
  doctor: "Give care instructions or reply to the nurse...",
  nurse: "Report patient updates to the doctor...",
  admin: "Share a team or operational update...",
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const key = role === "broadcast" ? "broadcast" : role;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        ROLE_BADGE_CLASS[key] ?? ROLE_BADGE_CLASS.admin,
        className
      )}
    >
      {ROLE_LABEL[key] ?? (role || "Staff")}
    </span>
  );
}

export function PatientPill({
  code,
  tone = "default",
}: {
  code: string;
  tone?: "default" | "onTeal" | "onBroadcast";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        tone === "onTeal" && "bg-white/20 text-white",
        tone === "onBroadcast" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
        tone === "default" &&
          "border border-slate-200 bg-teal-50 text-teal-800 dark:border-slate-600 dark:bg-teal-950/50 dark:text-teal-200"
      )}
    >
      <span aria-hidden>🩺</span>
      {code}
    </span>
  );
}

export function AvatarCircle({
  name,
  role,
  src,
  username,
  size = "md",
  online = false,
}: {
  name: string;
  role?: string;
  /** Real profile photo URL or data URL; falls back to account default, then initials. */
  src?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "lg";
  /** Green presence dot — only when the peer is actually online. */
  online?: boolean;
}) {
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs";
  const initials = name
    .replace(/^Dr\.\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  const explicitSrc = src !== undefined && src !== null;
  const photo = explicitSrc
    ? String(src).trim()
    : role === "broadcast"
      ? ""
      : resolveStaffAvatar({ username, role });
  const showPhoto = Boolean(photo) && role !== "broadcast";

  return (
    <div className="relative shrink-0 overflow-visible">
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-sm",
          dim,
          showPhoto
            ? "bg-slate-200 dark:bg-slate-700"
            : role === "broadcast"
              ? "bg-amber-500"
              : role === "nurse"
                ? "bg-emerald-500"
                : role === "admin"
                  ? "bg-violet-500"
                  : "bg-sky-500"
        )}
      >
        {showPhoto ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : role === "broadcast" ? (
          "📢"
        ) : (
          initials
        )}
      </div>
      {online && role !== "broadcast" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900"
          title="Online"
        />
      )}
    </div>
  );
}
