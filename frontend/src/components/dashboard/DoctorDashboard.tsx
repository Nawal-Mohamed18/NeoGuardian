import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Baby, HeartPulse, BellRing, Brain } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { AssignedUnitBanner } from "@/components/dashboard/AssignedUnitBanner";
import { LiveRiskCharts } from "@/components/dashboard/LiveRiskCharts";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { PageLoading } from "@/components/shared/PageLoading";
import {
  useAnalyticsDashboard,
  useOutcomeTrends,
  useAlertSummary,
} from "@/hooks/useDashboard";
import { usePatients } from "@/hooks/usePatients";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuth } from "@/context/AuthContext";
import { assignedPodsFromUser, scopePatientsForRole } from "@/lib/podScope";
import { alignMortalityRisk, comparePatientsByRisk } from "@/lib/risk";
import { formatDateTime } from "@/lib/utils";
import type { Patient } from "@/types";

export function DoctorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const assignedPods = useMemo(() => assignedPodsFromUser(user), [user]);

  const { data: analytics } = useAnalyticsDashboard();
  const { data: outcomeTrends = [] } = useOutcomeTrends();
  const { data: alertSummary } = useAlertSummary();
  const { data: patients = [], isLoading } = usePatients();
  const { data: alerts = [] } = useAlerts();

  const activePatients = useMemo(
    () =>
      scopePatientsForRole(patients as Patient[], {
        role: "doctor",
        assignedPods,
      }).sort(comparePatientsByRisk),
    [patients, assignedPods]
  );

  const activeAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (a.acknowledged) return false;
        if (!assignedPods.length) return false;
        const patient = activePatients.find((p) => p.id === a.patient);
        return !!patient;
      }),
    [alerts, activePatients, assignedPods]
  );

  const riskCounts = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;
    for (const p of activePatients) {
      const tier = p.latest_assessment
        ? alignMortalityRisk(
            p.latest_assessment.mortality_tier,
            p.latest_assessment.mortality_probability
          ).tier
        : "Low";
      if (tier === "High") high += 1;
      else if (tier === "Moderate") moderate += 1;
      else low += 1;
    }
    return { high, moderate, low };
  }, [activePatients]);

  const activeCases = useMemo(
    () =>
      activePatients
        .filter((p) => {
          if (!p.latest_assessment) return false;
          const tier = alignMortalityRisk(
            p.latest_assessment.mortality_tier,
            p.latest_assessment.mortality_probability
          ).tier;
          return tier === "High" || tier === "Moderate";
        })
        .sort(
          (a, b) =>
            (b.latest_assessment?.mortality_probability ?? 0) -
            (a.latest_assessment?.mortality_probability ?? 0)
        ),
    [activePatients]
  );

  const highCount = riskCounts.high;
  const mediumCount = riskCounts.moderate;
  const lowCount = riskCounts.low;

  const pieData = useMemo(
    () => [
      { name: "High", value: riskCounts.high },
      { name: "Moderate", value: riskCounts.moderate },
      { name: "Low", value: riskCounts.low },
    ],
    [riskCounts]
  );

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-4">
      <AssignedUnitBanner
        pods={assignedPods}
        actions={[
          { label: "Admit Newborn", to: "/newborns/register" },
          { label: "View Alerts", to: "/notifications", variant: "outline" },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Active Patients"
          value={activePatients.length}
          icon={Baby}
          tone="sky"
          delta={assignedPods.length ? `${assignedPods.length} pod(s)` : "Assign a POD"}
        />
        <StatCard label="High Risk" value={highCount} icon={HeartPulse} tone="red" delta="Requires evaluation" deltaTone="bad" />
        <StatCard label="Moderate Risk" value={mediumCount} icon={HeartPulse} tone="amber" delta="Close monitoring" />
        <StatCard label="Low Risk" value={lowCount} icon={HeartPulse} tone="emerald" delta="Stable status" deltaTone="good" />
        <StatCard label="AI Runs Today" value={analytics?.predictions_today ?? 0} icon={Brain} tone="violet" delta="Assessments today" />
        <StatCard
          label="Active Alerts"
          value={alertSummary?.total_active ?? activeAlerts.length}
          icon={BellRing}
          tone="red"
          delta={
            (alertSummary?.critical ?? 0) > 0
              ? `Critical ${alertSummary?.critical ?? 0}`
              : (alertSummary?.warning ?? 0) > 0
                ? `Moderate ${alertSummary?.warning ?? 0}`
                : "Latest risk only"
          }
          href="/notifications"
        />
      </div>

      <LiveRiskCharts
        pieData={pieData}
        vitals={outcomeTrends}
        showVitals
        pieTitle="Risk Distribution"
      />

      {activeCases.length > 0 && (
        <SectionCard
          title="Active AI Cases"
          className="min-h-0"
          bodyClassName="flex min-h-0 max-h-72 flex-col overflow-hidden p-0 sm:max-h-80"
        >
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-left text-xs uppercase text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-2">Patient</th>
                  <th className="px-4 py-2">POD</th>
                  <th className="px-4 py-2">Risk</th>
                  <th className="px-4 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {activeCases.map((p) => (
                  <tr
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/newborns/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/newborns/${p.id}`);
                      }
                    }}
                    className="group cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/10"
                  >
                    <td className="px-4 py-2">
                      <strong className="transition-colors group-hover:text-primary">
                        {p.display_name || p.patient_code}
                      </strong>
                      <div className="text-xs text-muted-foreground">{p.patient_code}</div>
                    </td>
                    <td className="px-4 py-2">{p.pod_name || "—"}</td>
                    <td className="px-4 py-2">
                      {p.latest_assessment ? (
                        <MortalityBadge
                          tier={p.latest_assessment.mortality_tier}
                          probability={p.latest_assessment.mortality_probability}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {p.latest_assessment?.mortality_probability.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Active Clinical Patients"
          className="min-h-0"
          bodyClassName="flex min-h-0 max-h-72 flex-col overflow-hidden p-0 sm:max-h-80"
        >
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-left text-xs uppercase text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">GA / BW</th>
                  <th className="px-4 py-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {activePatients.map((p) => (
                  <tr
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/newborns/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/newborns/${p.id}`);
                      }
                    }}
                    className="group cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/10"
                  >
                    <td className="px-4 py-2 font-medium text-primary transition-colors group-hover:underline">
                      {p.patient_code}
                    </td>
                    <td className="px-4 py-2">
                      {p.gestational_age}w / {p.birth_weight}kg
                    </td>
                    <td className="px-4 py-2">
                      {p.latest_assessment ? (
                        <MortalityBadge
                          tier={p.latest_assessment.mortality_tier}
                          probability={p.latest_assessment.mortality_probability}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Active Alerts"
          viewAllHref="/notifications"
          className="min-h-0"
          bodyClassName="flex min-h-0 max-h-72 flex-col overflow-hidden p-4 sm:max-h-80"
        >
          {activeAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All neonatal risk profiles are currently stable.</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {activeAlerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(`/newborns/${a.patient}`)}
                  className="w-full rounded-lg border border-border bg-card/40 p-3 text-left transition-colors hover:border-primary/45 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{a.title}</strong>
                    <span className="text-[10px] uppercase text-muted-foreground">{a.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {a.patient_code} · {formatDateTime(a.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
