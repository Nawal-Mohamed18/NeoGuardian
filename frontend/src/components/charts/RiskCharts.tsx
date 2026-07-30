import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RISK_COLORS } from "@/hooks/useLiveChartData";
import type { DashboardStats, MortalityTier } from "@/types";

const TIER_COLORS: Record<MortalityTier, string> = {
  High: RISK_COLORS.High,
  Moderate: RISK_COLORS.Moderate,
  Low: RISK_COLORS.Low,
};

const TIERS: MortalityTier[] = ["High", "Moderate", "Low"];

interface RiskChartsProps {
  stats: DashboardStats | undefined;
}

export function RiskCharts({ stats }: RiskChartsProps) {
  const dist = stats?.mortality_distribution ?? { High: 0, Moderate: 0, Low: 0 };
  const pieData = TIERS.map((tier) => ({
    name: tier,
    value: dist[tier] ?? 0,
  })).filter((d) => d.value > 0);

  const trend = stats?.trend ?? [];
  const hasTrend = trend.some((d) => d.high > 0 || d.medium > 0 || d.low > 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Risk Tier Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 min-h-[224px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={TIER_COLORS[d.name as MortalityTier] ?? TIER_COLORS.Low} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No assessed patients yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader><CardTitle>Elevated Risk Over Time</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 min-h-[224px] w-full">
            {hasTrend ? (
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="high" name="High" stroke={RISK_COLORS.High} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="medium" name="Moderate" stroke={RISK_COLORS.Moderate} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="low" name="Low" stroke={RISK_COLORS.Low} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No assessments in the last 7 days
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
