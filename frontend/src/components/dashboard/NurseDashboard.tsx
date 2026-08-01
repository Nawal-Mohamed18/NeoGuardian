import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Baby, HeartPulse, BellRing, ClipboardPlus, UserPlus } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { AssignedUnitBanner } from "@/components/dashboard/AssignedUnitBanner";
import { LiveRiskCharts } from "@/components/dashboard/LiveRiskCharts";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { PageLoading } from "@/components/shared/PageLoading";
import {
  useAnalyticsDashboard,
  useAlertSummary,
} from "@/hooks/useDashboard";
import { usePatients } from "@/hooks/usePatients";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuth } from "@/context/AuthContext";
import { assignedPodsFromUser, scopePatientsForRole } from "@/lib/podScope";
import { alignMortalityRisk, comparePatientsByRisk } from "@/lib/risk";
import { formatDateTime } from "@/lib/utils";
import type { Patient } from "@/types";

export function NurseDashboard() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const assignedPods = useMemo(() => assignedPodsFromUser(user), [user]);
  const assignedPod = assignedPods[0] ?? null;

  const { data: analytics } = useAnalyticsDashboard();
  const { data: alertSummary } = useAlertSummary();
  const { data: patients = [], isLoading } = usePatients();
  const { data: alerts = [] } = useAlerts();

  const myPatients = useMemo(
    () =>
      scopePatientsForRole(patients as Patient[], {
        role: "nurse",
        assignedPods,
      }).sort(comparePatientsByRisk),
    [patients, assignedPods]
  );

  const riskCounts = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;
    for (const p of myPatients) {
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
  }, [myPatients]);

  const attentionPatients = useMemo(
    () =>
      myPatients
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
    [myPatients]
  );

  const myAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (a.acknowledged) return false;
        if (!assignedPods.length) return false;
        const patient = myPatients.find((p) => p.id === a.patient);
        return !!patient;
      }),
    [alerts, myPatients, assignedPods]
  );

  const pieData = useMemo(
    () => [
      { name: "High", value: riskCounts.high },
      { name: "Moderate", value: riskCounts.moderate },
      { name: "Low", value: riskCounts.low },
    ],
    [riskCounts]
  );

  const nurseActions = [
    { label: "My Patients", to: "/my-patients", variant: "outline" as const },
    ...(can("assessment.create")
      ? [{ label: "Admit", to: "/newborns/register", icon: <UserPlus className="mr-1 h-4 w-4" /> }]
      : []),
  ];

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-4">
      <AssignedUnitBanner
        pods={assignedPods}
        helper="Your pod only."
        emptyHelper="Ask admin for a POD."
        actions={nurseActions}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="My Patients"
          value={myPatients.length}
          icon={Baby}
          tone="sky"
          delta={assignedPod ? `In ${assignedPod}` : "No POD assigned"}
          href="/my-patients"
        />
        <StatCard
          label="High Risk"
          value={riskCounts.high}
          icon={HeartPulse}
          tone="red"
          delta="Needs priority care"
          deltaTone="bad"
          href="/my-patients"
        />
        <StatCard
          label="Moderate Risk"
          value={riskCounts.moderate}
          icon={HeartPulse}
          tone="amber"
          delta="Close monitoring"
          href="/my-patients"
        />
        <StatCard
          label="Active Alerts"
          value={alertSummary?.total_active ?? myAlerts.length}
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
        <StatCard
          label="AI Runs Today"
          value={analytics?.predictions_today ?? 0}
          icon={ClipboardPlus}
          tone="violet"
          delta="Assessments today"
        />
      </div>

      <LiveRiskCharts
        pieData={pieData}
        pieTitle="Risk Distribution (My Unit)"
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          title="Patients Needing Attention"
          viewAllHref="/my-patients"
          className="min-h-0"
          bodyClassName="flex min-h-0 max-h-72 flex-col overflow-hidden p-0 sm:max-h-80"
        >
          {attentionPatients.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No high or moderate risk patients in your unit right now.
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-left text-xs uppercase text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-2">Patient</th>
                    <th className="px-4 py-2">Bed</th>
                    <th className="px-4 py-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionPatients.map((p) => (
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
                      <td className="px-4 py-2">{p.bed_number || "—"}</td>
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
          )}
        </SectionCard>

        <SectionCard
          title="Active Alerts"
          viewAllHref="/notifications"
          className="min-h-0"
          bodyClassName="flex min-h-0 max-h-72 flex-col overflow-hidden p-4 sm:max-h-80"
        >
          {myAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unacknowledged alerts for your patients.</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {myAlerts.map((a) => (
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
