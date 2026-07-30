import { useMemo } from "react";
import { Download, Baby, HeartPulse, BellRing, Brain } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { StatCard } from "@/components/dashboard/StatCard";
import { LiveRiskCharts } from "@/components/dashboard/LiveRiskCharts";
import { Button } from "@/components/ui/button";
import {
  useAnalyticsDashboard,
  useRiskTrends,
  useOutcomeTrends,
  useAlertSummary,
} from "@/hooks/useDashboard";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { assignedPodsFromUser, scopePatientsForRole } from "@/lib/podScope";
import { alignMortalityRisk } from "@/lib/risk";
import type { Patient } from "@/types";
import type { OutcomeTrendPoint, RiskTrendPoint } from "@/types/clinical";

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const assignedPods = useMemo(() => assignedPodsFromUser(user), [user]);
  const { data: analytics, isLoading: loadingAnalytics } = useAnalyticsDashboard();
  const { data: trends = [], isLoading: loadingTrends } = useRiskTrends();
  const { data: outcomeTrends = [] } = useOutcomeTrends();
  const { data: alertSummary } = useAlertSummary();
  const { data: patientsRaw = [], isLoading: loadingPatients } = usePatients({ status: "active" });

  const patients = useMemo(
    () =>
      scopePatientsForRole(patientsRaw as Patient[], {
        role,
        assignedPods,
        activeOnly: true,
      }),
    [patientsRaw, role, assignedPods]
  );

  const riskCounts = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;
    for (const p of patients) {
      if (!p.latest_assessment) continue;
      const tier = alignMortalityRisk(
        p.latest_assessment.mortality_tier,
        p.latest_assessment.mortality_probability
      ).tier;
      if (tier === "High") high += 1;
      else if (tier === "Moderate") moderate += 1;
      else low += 1;
    }
    return { high, moderate, low };
  }, [patients]);

  const pieData = useMemo(
    () => [
      { name: "High", value: riskCounts.high },
      { name: "Moderate", value: riskCounts.moderate },
      { name: "Low", value: riskCounts.low },
    ],
    [riskCounts]
  );

  const showVitals = role === "doctor" || role === "admin";
  const isLoading = loadingAnalytics || loadingTrends || loadingPatients;

  function downloadPatientRiskCsv() {
    const header = [
      "patient_code",
      "display_name",
      "pod",
      "bed",
      "status",
      "risk_tier",
      "risk_percent",
      "assessed_at",
    ];
    const rows = patients.map((p) => {
      const aligned = p.latest_assessment
        ? alignMortalityRisk(
            p.latest_assessment.mortality_tier,
            p.latest_assessment.mortality_probability
          )
        : null;
      return [
        p.patient_code,
        p.display_name || "",
        p.pod_name || "",
        p.bed_number || "",
        p.status || "active",
        aligned?.tier || "",
        aligned ? aligned.probability.toFixed(1) : "",
        p.latest_assessment?.created_at || "",
      ];
    });
    downloadCsv(`neoguardian-patient-risk-${stamp()}.csv`, [header, ...rows]);
  }

  function downloadTrendsCsv() {
    const header = ["date", "high", "moderate", "low"];
    const rows = (trends as RiskTrendPoint[]).map((t) => [
      t.date,
      t.high,
      t.medium,
      t.low,
    ]);
    downloadCsv(`neoguardian-risk-trends-30d-${stamp()}.csv`, [header, ...rows]);
  }

  function downloadVitalsCsv() {
    const header = ["date", "avg_hr", "avg_spo2"];
    const rows = (outcomeTrends as OutcomeTrendPoint[]).map((t) => [
      t.date,
      t.avg_hr ?? "",
      t.avg_spo2 ?? "",
    ]);
    downloadCsv(`neoguardian-vitals-7d-${stamp()}.csv`, [header, ...rows]);
  }

  function downloadSummaryCsv() {
    downloadCsv(`neoguardian-unit-summary-${stamp()}.csv`, [
      ["metric", "value"],
      ["active_patients", (patients as Patient[]).length],
      ["high_risk", riskCounts.high],
      ["moderate_risk", riskCounts.moderate],
      ["low_risk", riskCounts.low],
      ["ai_runs_today", analytics?.predictions_today ?? 0],
      ["active_alerts", alertSummary?.total_active ?? 0],
      ["critical_alerts", alertSummary?.critical ?? 0],
      ["exported_at", new Date().toISOString()],
    ]);
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Reports"
        description="Unit risk distribution, 30-day trends, and assessment activity for your assigned scope."
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadSummaryCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Summary CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPatientRiskCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Patients CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTrendsCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Trends CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadVitalsCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Vitals CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Active Patients"
          value={(patients as Patient[]).length}
          icon={Baby}
          tone="sky"
        />
        <StatCard
          label="High Risk"
          value={riskCounts.high}
          icon={HeartPulse}
          tone="red"
          delta="Priority"
          deltaTone="bad"
        />
        <StatCard
          label="AI Runs Today"
          value={analytics?.predictions_today ?? 0}
          icon={Brain}
          tone="violet"
        />
        <StatCard
          label="Active Alerts"
          value={alertSummary?.total_active ?? 0}
          icon={BellRing}
          tone="red"
          href="/notifications"
        />
      </div>

      <LiveRiskCharts
        pieData={pieData}
        vitals={outcomeTrends}
        showVitals={showVitals}
        pieTitle="Risk Distribution"
      />
    </AppLayout>
  );
}
