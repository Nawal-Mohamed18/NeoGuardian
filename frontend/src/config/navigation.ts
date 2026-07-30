import {
  LayoutDashboard,
  Bell,
  Users,
  Settings,
  Building2,
  Baby,
  MessageSquare,
  UserPlus,
  FileBarChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Capability, Role } from "@/lib/roles";

export type NavStatus = "ready" | "soon";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  status: NavStatus;
  match?: (path: string) => boolean;
  capability?: Capability;
  /** When set, item is shown only for these roles. */
  roles?: Role[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      {
        label: "Overview",
        href: "/",
        icon: LayoutDashboard,
        status: "ready",
        match: (p) => p === "/",
      },
      {
        label: "My Patients",
        href: "/my-patients",
        icon: Baby,
        status: "ready",
        match: (p) => p.startsWith("/my-patients"),
        roles: ["nurse", "doctor"],
      },
      {
        label: "Patients",
        href: "/patients",
        icon: Baby,
        status: "ready",
        match: (p) =>
          p.startsWith("/patients") ||
          (p.startsWith("/newborns") && !p.startsWith("/newborns/register")),
        roles: ["admin"],
      },
      {
        label: "Admit Newborn",
        href: "/newborns/register",
        icon: UserPlus,
        status: "ready",
        match: (p) => p.startsWith("/newborns/register"),
        capability: "assessment.create",
      },
      {
        label: "Staff Chat",
        href: "/chat",
        icon: MessageSquare,
        status: "ready",
        match: (p) => p.startsWith("/chat"),
      },
      {
        label: "Clinical Staff",
        href: "/users",
        icon: Users,
        status: "ready",
        match: (p) => p.startsWith("/users"),
        capability: "user.manage",
      },
      {
        label: "Alerts",
        href: "/notifications",
        icon: Bell,
        status: "ready",
        match: (p) => p.startsWith("/notifications"),
      },
      {
        label: "Manage PODs",
        href: "/pods",
        icon: Building2,
        status: "ready",
        match: (p) => p.startsWith("/pods"),
        capability: "user.manage",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: FileBarChart,
        status: "ready",
        match: (p) => p.startsWith("/reports"),
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        status: "ready",
        match: (p) => p.startsWith("/settings"),
      },
    ],
  },
];

export const sidebarNav: NavItem[] = navSections.flatMap((s) => s.items);

export const READY_HREFS: string[] = sidebarNav
  .filter((item) => item.status === "ready")
  .map((item) => item.href);

export function isReady(href: string): boolean {
  return READY_HREFS.includes(href);
}
