import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Stethoscope,
  Baby,
  Building2,
  BellRing,
  Brain,
  Activity,
  UserCog,
  FileText,
  Bell,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { LiveRiskCharts } from "@/components/dashboard/LiveRiskCharts";
import { PageLoading } from "@/components/shared/PageLoading";
import {
  useAdminSystemStats,
  usePodStats,
  useAnalyticsDashboard,
  useOutcomeTrends,
} from "@/hooks/useDashboard";
import { useChartDataSignature, useChartLiveTick } from "@/hooks/useLiveChartData";
import type { AdminSystemStats } from "@/types/clinical";

function AdminModuleCard({
  to,
  title,
  description,
  icon: Icon,
  toneClass,
  iconClass,
}: {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  toneClass: string;
  iconClass: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className={`h-5 w-5 ${iconClass}`} />
      </div>
      <strong className="block text-sm">{title}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </Link>
  );
}

export function AdminDashboard() {
  const { data: stats, isLoading } = useAdminSystemStats();
  const { data: pods = [] } = usePodStats();
  const { data: analytics } = useAnalyticsDashboard();
  const { data: outcomeTrends = [] } = useOutcomeTrends();
  const occupancyKey = useChartDataSignature(pods);
  const tick = useChartLiveTick(5000);

  const pieData = useMemo(
    () => [
      { name: "High", value: analytics?.high_risk ?? 0 },
      { name: "Moderate", value: analytics?.medium_risk ?? 0 },
      { name: "Low", value: analytics?.low_risk ?? 0 },
    ],
    [analytics]
  );

  const occupancyData = useMemo(
    () =>
      pods.map((pod) => ({
        name: pod.ward,
        occupied: pod.total,
        available: pod.available,
        high: pod.high,
      })),
    [pods]
  );

  if (isLoading || !stats) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <h1 className="relative text-2xl font-bold tracking-tight text-card-foreground">System Overview</h1>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Hospital-wide census, capacity, AI load, and access controls
        </p>
      </section>

      <AdminKpis stats={stats} />

      <LiveRiskCharts
        pieData={pieData}
        vitals={outcomeTrends}
        showVitals
        pieTitle="Hospital Risk Mix"
      />

      <SectionCard
        title="POD Occupancy (Live)"
        bodyClassName="p-3"
      >
        <p className="-mt-1 mb-2 px-1 text-[11px] text-muted-foreground">
          Live census from active patients — occupied beds, free capacity, and high-risk count per POD
        </p>
        {occupancyData.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No NICU pods configured yet.</p>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`occ-${occupancyKey}-${tick}`} data={occupancyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  width={28}
                  stroke="var(--color-border)"
                />
                <Tooltip
                  cursor={{
                    fill: "color-mix(in oklab, var(--color-muted-foreground) 14%, transparent)",
                  }}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-card-foreground)",
                    boxShadow: "0 8px 24px rgb(15 23 42 / 0.28)",
                  }}
                  labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ color: "var(--color-muted-foreground)" }} />
                <Bar
                  dataKey="occupied"
                  name="Occupied"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Bar
                  dataKey="available"
                  name="Available"
                  fill="var(--color-muted-foreground)"
                  fillOpacity={0.45}
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Bar
                  dataKey="high"
                  name="High risk"
                  fill="#f87171"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={1100}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Administrative Controls" className="lg:col-span-2" bodyClassName="p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Select a control module below to manage user permissions, POD capacity, or review patients.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminModuleCard
              to="/patients"
              title="All Patients"
              description="Active, discharged, and transferred registry."
              icon={Baby}
              toneClass="bg-teal-500/10"
              iconClass="text-teal-700 dark:text-teal-300"
            />
            <AdminModuleCard
              to="/users"
              title="Clinical Staff Directory"
              description="Register, activate, deactivate, or remove clinical staff."
              icon={Users}
              toneClass="bg-teal-500/10"
              iconClass="text-teal-700 dark:text-teal-300"
            />
            <AdminModuleCard
              to="/notifications"
              title="Clinical Alerts"
              description="Review unresolved risk and vitals alerts."
              icon={Bell}
              toneClass="bg-teal-500/10"
              iconClass="text-teal-700 dark:text-teal-300"
            />
            <AdminModuleCard
              to="/pods"
              title="PODs & Beds"
              description="Set bed capacity and assign staff per NICU pod."
              icon={Building2}
              toneClass="bg-teal-500/10"
              iconClass="text-teal-700 dark:text-teal-300"
            />
          </div>
        </SectionCard>

        <SectionCard title="System Diagnostics" bodyClassName="p-4">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Database Status</span>
              <span className="font-semibold text-emerald-600">Operational</span>
            </li>
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">AI Core Engine</span>
              <span className="font-semibold text-emerald-600">Ready</span>
            </li>
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Audit Logs</span>
              <span className="font-semibold">{stats.audit_logs}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="text-xs text-muted-foreground">
                {new Date(stats.last_sync).toLocaleTimeString()}
              </span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function AdminKpis({ stats }: { stats: AdminSystemStats }) {
  const kpis = [
    {
      label: "Active Doctors",
      value: stats.doctors,
      icon: Stethoscope,
      tone: "sky" as const,
      delta: "Clinical leads on duty",
    },
    {
      label: "Active Nurses",
      value: stats.nurses,
      icon: Users,
      tone: "emerald" as const,
      delta: "Ward caregivers",
    },
    {
      label: "Active Neonates",
      value: stats.patients_active,
      icon: Baby,
      tone: "violet" as const,
      delta: `Discharged ${stats.patients_discharged}`,
      href: "/patients",
    },
    {
      label: "NICU PODs",
      value: stats.wards,
      icon: Building2,
      tone: "amber" as const,
      delta: "Pods configured",
      href: "/pods",
    },
    {
      label: "Active Alerts",
      value: stats.alerts_active,
      icon: BellRing,
      tone: "red" as const,
      delta: "Unresolved clinical alerts",
      deltaTone: stats.alerts_active > 0 ? ("bad" as const) : ("good" as const),
      href: "/notifications",
    },
    {
      label: "Avg System Risk",
      value: `${stats.average_risk_score.toFixed(1)}%`,
      icon: Activity,
      tone: "orange" as const,
      delta: "28-day AI estimate",
    },
    {
      label: "Total Staff",
      value: stats.users,
      icon: UserCog,
      tone: "teal" as const,
      delta: `Incl. ${stats.admins} admin(s)`,
      href: "/users",
    },
    {
      label: "AI Predictions Today",
      value: stats.predictions_today,
      icon: Brain,
      tone: "indigo" as const,
      delta: `Total runs: ${stats.predictions_total}`,
    },
    {
      label: "Audit Logs",
      value: stats.audit_logs,
      icon: FileText,
      tone: "slate" as const,
      delta: "System activity events",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <StatCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
