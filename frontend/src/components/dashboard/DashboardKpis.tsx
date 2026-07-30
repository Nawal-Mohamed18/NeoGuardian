import { Baby, HeartPulse, BellRing, Brain, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatCard, type StatCardTone } from "./StatCard";
import type { DashboardStats } from "@/types";

interface DashboardKpisProps {
  stats: DashboardStats;
}

interface KpiDef {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: StatCardTone;
  href?: string;
  delta?: string;
  deltaTone?: "good" | "bad" | "neutral";
}

function elevatedCount(dist: DashboardStats["mortality_distribution"]) {
  return (dist.High ?? 0) + (dist.Moderate ?? 0);
}

export function DashboardKpis({ stats }: DashboardKpisProps) {
  const dist = stats.mortality_distribution ?? { High: 0, Moderate: 0, Low: 0 };
  const elevated = elevatedCount(dist);
  const unack = stats.unacknowledged_alerts ?? 0;

  const kpis: KpiDef[] = [
    {
      label: "Assessments Today",
      value: stats.predictions_today ?? 0,
      icon: Brain,
      tone: "violet",
      href: "/newborns",
      delta: "AI assessments run",
      deltaTone: "neutral",
    },
    {
      label: "Elevated Risk",
      value: elevated,
      icon: HeartPulse,
      tone: "red",
      href: "/newborns",
      delta: elevated > 0 ? `${dist.High ?? 0} high` : "All stable",
      deltaTone: elevated > 0 ? "bad" : "good",
    },
    {
      label: "Patients Avg Risk",
      value: `${(stats.avg_mortality_probability ?? 0).toFixed(1)}%`,
      icon: TrendingDown,
      tone: "teal",
      href: "/reports",
      delta: "28-day estimate",
      deltaTone: "neutral",
    },
    {
      label: "Active Alerts",
      value: unack,
      icon: BellRing,
      tone: "amber",
      href: "/notifications",
      delta: unack > 0 ? "Unacknowledged" : "Inbox clear",
      deltaTone: unack > 0 ? "bad" : "good",
    },
    {
      label: "Patients",
      value: stats.total_patients,
      icon: Baby,
      tone: "sky",
      href: "/newborns",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <StatCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

export { elevatedCount };
