import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  CHART_HR,
  CHART_TEAL,
  formatChartDay,
  formatChartMonth,
  RISK_COLORS,
  RISK_PIE_COLORS,
  useChartDataSignature,
  useChartLiveTick,
} from "@/hooks/useLiveChartData";
import { useRiskTrends } from "@/hooks/useDashboard";
import { cn } from "@/lib/utils";
import type { OutcomeTrendPoint, RiskTrendPoint } from "@/types/clinical";

type PieSlice = { name: string; value: number };
type TrendGranularity = "day" | "month";

type LiveRiskChartsProps = {
  pieData: PieSlice[];
  /** Optional fallback; chart prefers its own Day/Month fetch. */
  trends?: RiskTrendPoint[];
  vitals?: OutcomeTrendPoint[];
  showVitals?: boolean;
  pieTitle?: string;
};

const AXIS_TICK = { fontSize: 10, fill: "var(--color-muted-foreground)", fontWeight: 500 } as const;
const GRID_STROKE = "color-mix(in oklab, var(--color-muted-foreground) 28%, transparent)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-card-foreground)",
  boxShadow: "0 8px 24px rgb(15 23 42 / 0.28)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

function softDot(stroke: string) {
  return {
    r: 3.5,
    strokeWidth: 2,
    stroke,
    fill: "var(--color-card)",
  };
}

function softActiveDot(stroke: string) {
  return {
    r: 6,
    strokeWidth: 2.5,
    stroke,
    fill: "var(--color-card)",
  };
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[240px] [&_.recharts-surface]:outline-none [&_.recharts-legend-item-text]:fill-current [&_.recharts-legend-item-text]:text-muted-foreground [&_.recharts-cartesian-axis-tick-value]:font-medium">
      {children}
    </div>
  );
}

export function LiveRiskCharts({
  pieData,
  trends: trendsFallback = [],
  vitals = [],
  showVitals = false,
  pieTitle = "Risk Distribution",
}: LiveRiskChartsProps) {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  const { data: trendsFetched } = useRiskTrends(granularity);
  const trends = trendsFetched ?? trendsFallback;

  const tick = useChartLiveTick(5000);
  const pieKey = useChartDataSignature(pieData);
  const trendKey = useChartDataSignature(trends);
  const vitalsKey = useChartDataSignature(vitals);

  const normalizedPie = ["High", "Moderate", "Low"].map((name) => {
    const found = pieData.find((d) => d.name === name);
    return { name, value: found?.value ?? 0 };
  });
  const pieTotal = normalizedPie.reduce((sum, d) => sum + d.value, 0);
  const visiblePie = normalizedPie.filter((d) => d.value > 0);

  const hasTrend = trends.some((d) => d.high > 0 || d.medium > 0 || d.low > 0);
  const hasVitals = vitals.some(
    (d) => (typeof d.avg_hr === "number" && d.avg_hr > 0) || (typeof d.avg_spo2 === "number" && d.avg_spo2 > 0)
  );

  const trendMeta = useMemo(() => {
    const n = trends.length;
    if (granularity === "month") {
      return {
        title: n >= 12 ? "Patients by risk tier (12 months)" : "Patients by risk tier (by month)",
        subtitle:
          n <= 1
            ? "Counts by month — grows as you accumulate history (up to 12 months)"
            : `How many High / Moderate / Low patients at each month-end (${n} months)`,
      };
    }
    if (n >= 30) {
      return {
        title: "Patients by risk tier (last 30 days)",
        subtitle: "Rolling window — High / Moderate / Low patients each day",
      };
    }
    return {
      title: n <= 1 ? "Patients by risk tier" : `Patients by risk tier (${n} days)`,
      subtitle:
        n <= 1
          ? "Starts on first assessment — grows day by day up to 30 days, then rolls"
          : `Growing history (${n}/30 days) — then switches to a rolling last-30-days window`,
    };
  }, [granularity, trends.length]);

  const gridCols = showVitals ? "xl:grid-cols-3" : "xl:grid-cols-2";
  const tickFormatter = granularity === "month" ? formatChartMonth : formatChartDay;

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <header className="border-b border-border/70 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{pieTitle}</h3>
        </header>
        <div className="p-3">
          <ChartShell>
            {pieTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={`pie-${pieKey}-${tick}`}>
                  <Pie
                    data={visiblePie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={4}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={1100}
                    animationEasing="ease-out"
                  >
                    {visiblePie.map((d) => (
                      <Cell
                        key={d.name}
                        fill={RISK_PIE_COLORS[d.name] ?? "#94a3b8"}
                        stroke="transparent"
                        fillOpacity={0.92}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    formatter={(value) => {
                      const row = normalizedPie.find((d) => d.name === value);
                      return `${value} (${row?.value ?? 0})`;
                    }}
                    wrapperStyle={{ color: "var(--color-muted-foreground)" }}
                    payload={normalizedPie.map((d) => ({
                      value: d.name,
                      type: "circle",
                      color: RISK_PIE_COLORS[d.name] ?? "#94a3b8",
                      id: d.name,
                    }))}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No assessed patients yet" />
            )}
          </ChartShell>
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{trendMeta.title}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{trendMeta.subtitle}</p>
          </div>
          <div className="flex shrink-0 rounded-md border border-border bg-muted/40 p-0.5">
            {(["day", "month"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-medium capitalize transition",
                  granularity === g
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {g === "day" ? "Days" : "Months"}
              </button>
            ))}
          </div>
        </header>
        <div className="p-3">
          <ChartShell>
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  key={`trend-${trendKey}-${tick}`}
                  data={trends}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`highFill-${tick}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={RISK_COLORS.High} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={RISK_COLORS.High} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id={`modFill-${tick}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={RISK_COLORS.Moderate} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={RISK_COLORS.Moderate} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id={`lowFill-${tick}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={RISK_COLORS.Low} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={RISK_COLORS.Low} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" stroke={GRID_STROKE} vertical horizontal />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickFormatter={tickFormatter}
                    minTickGap={granularity === "month" ? 8 : 18}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    allowDecimals={false}
                    width={28}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 }}
                    labelFormatter={(v) =>
                      granularity === "month" ? `As of ${formatChartMonth(String(v))}` : `As of ${String(v)}`
                    }
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ color: "var(--color-muted-foreground)", paddingTop: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="high"
                    name="High"
                    stroke={RISK_COLORS.High}
                    fill={`url(#highFill-${tick})`}
                    strokeWidth={2.25}
                    dot={softDot(RISK_COLORS.High)}
                    activeDot={softActiveDot(RISK_COLORS.High)}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="medium"
                    name="Moderate"
                    stroke={RISK_COLORS.Moderate}
                    fill={`url(#modFill-${tick})`}
                    strokeWidth={2.25}
                    dot={softDot(RISK_COLORS.Moderate)}
                    activeDot={softActiveDot(RISK_COLORS.Moderate)}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="low"
                    name="Low"
                    stroke={RISK_COLORS.Low}
                    fill={`url(#lowFill-${tick})`}
                    strokeWidth={2.25}
                    dot={softDot(RISK_COLORS.Low)}
                    activeDot={softActiveDot(RISK_COLORS.Low)}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No assessed patients yet — chart grows after the first risk estimate" />
            )}
          </ChartShell>
        </div>
      </section>

      {showVitals && (
        <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <header className="border-b border-border/70 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Average Vitals (7 days)</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Unit mean HR / SpO₂ from each patient’s latest reading that day
            </p>
          </header>
          <div className="p-3">
            <ChartShell>
              {hasVitals ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    key={`vitals-${vitalsKey}-${tick}`}
                    data={vitals}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id={`hrFill-${tick}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_HR} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={CHART_HR} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id={`spo2Fill-${tick}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke={GRID_STROKE} vertical horizontal />
                    <XAxis
                      dataKey="date"
                      tick={AXIS_TICK}
                      tickFormatter={formatChartDay}
                      minTickGap={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tick={AXIS_TICK}
                      domain={[0, 200]}
                      width={32}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={AXIS_TICK}
                      domain={[70, 100]}
                      width={32}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 }}
                      labelFormatter={(v) => String(v)}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ color: "var(--color-muted-foreground)", paddingTop: 4 }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="avg_hr"
                      stroke={CHART_HR}
                      fill={`url(#hrFill-${tick})`}
                      name="HR (bpm)"
                      strokeWidth={2.25}
                      connectNulls={false}
                      dot={softDot(CHART_HR)}
                      activeDot={softActiveDot(CHART_HR)}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="avg_spo2"
                      stroke={CHART_TEAL}
                      fill={`url(#spo2Fill-${tick})`}
                      name="SpO2 (%)"
                      strokeWidth={2.25}
                      connectNulls={false}
                      dot={softDot(CHART_TEAL)}
                      activeDot={softActiveDot(CHART_TEAL)}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No vitals recorded in the last 7 days" />
              )}
            </ChartShell>
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
