import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { RISK_COLORS } from "@/hooks/useLiveChartData";
import type { DashboardStats, MortalityTier } from "@/types";

const TIER_COLORS: Record<MortalityTier, string> = {
  High: RISK_COLORS.High,
  Moderate: RISK_COLORS.Moderate,
  Low: RISK_COLORS.Low,
};

const TIERS: MortalityTier[] = ["High", "Moderate", "Low"];

interface DashboardRiskOverviewProps {
  stats: DashboardStats;
}

export function DashboardRiskOverview({ stats }: DashboardRiskOverviewProps) {
  const dist = stats.mortality_distribution ?? { High: 0, Moderate: 0, Low: 0 };
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const pieData = TIERS.map((tier) => ({
    name: tier,
    value: dist[tier] ?? 0,
    pct: Math.round(((dist[tier] ?? 0) / total) * 100),
  })).filter((d) => d.value > 0);

  const trend = stats.trend ?? [];
  const hasTrend = trend.some((d) => d.high > 0 || d.medium > 0 || d.low > 0);
  const hasDist = pieData.length > 0;

  return (
    <SectionCard
      title="Risk Overview"
      icon={BarChart3}
      iconClassName="text-teal-600"
      viewAllHref="/analytics"
      viewAllLabel="Population analytics"
      bodyClassName="p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Risk tier distribution
          </p>
          <div className="h-[130px] w-full">
            {hasDist ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={36}
                  outerRadius={54}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={TIER_COLORS[d.name as MortalityTier] ?? TIER_COLORS.Low} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value ?? 0} newborns`]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e6ebf1", fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No assessed patients yet
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {TIERS.filter((t) => (dist[t] ?? 0) > 0).map((tier) => (
              <div key={tier} className="flex items-center gap-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLORS[tier] }} />
                <span className="text-muted-foreground">{tier}</span>
                <span className="font-semibold text-foreground">{dist[tier]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sm:col-span-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Elevated-risk assessments over time
          </p>
          <div className="h-[130px] w-full">
            {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -22, bottom: -4 }}>
                <defs>
                  <linearGradient id="highMortGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RISK_COLORS.High} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={RISK_COLORS.High} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="medMortGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RISK_COLORS.Moderate} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={RISK_COLORS.Moderate} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf1" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e6ebf1", fontSize: 11 }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, paddingTop: 0 }} />
                <Area type="monotone" dataKey="high" name="High" stroke={RISK_COLORS.High} fill="url(#highMortGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="medium" name="Moderate" stroke={RISK_COLORS.Moderate} fill="url(#medMortGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="low" name="Low" stroke={RISK_COLORS.Low} fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No assessments in the last 7 days
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
