import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PatientOverview } from "@/components/patient/PatientOverview";
import { PatientAIInsights } from "@/components/patient/PatientAIInsights";
import { PatientChat } from "@/components/patient/PatientChat";
import { PatientTimeline } from "@/components/patient/PatientTimeline";
import { AdminPatientActions } from "@/components/patient/AdminPatientActions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatients, usePatient } from "@/hooks/usePatients";
import { useAssessments } from "@/hooks/useAssessments";
import { useAlerts } from "@/hooks/useAlerts";
import { cn, formatAdmittedBy } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { alignMortalityRisk, comparePatientsByRisk, formatClinicalNumber } from "@/lib/risk";

type RegistryStatus = "active" | "discharged";

/**
 * Patient chart. Admin: list-first on /patients, then chart with left rail.
 * Nurse/doctor: chart only (opened from My Patients).
 */
export default function NewbornsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can, role } = useAuth();
  const patientId = id ? parseInt(id) : undefined;
  const [search, setSearch] = useState("");
  const isAdmin = role === "admin";
  const showRail = isAdmin;
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  const registryStatus: RegistryStatus =
    searchParams.get("status") === "discharged" ? "discharged" : "active";
  const statusQuery = registryStatus === "discharged" ? "?status=discharged" : "";
  const listHref =
    registryStatus === "discharged" ? "/patients?status=discharged" : "/patients";

  const { data: patients, isLoading: listLoading } = usePatients(
    isAdmin ? { status: registryStatus } : undefined
  );
  const { data: patient, isLoading: patientLoading, isError } = usePatient(patientId);
  const { data: assessments } = useAssessments(patientId);
  const { data: alerts } = useAlerts();
  const unack = alerts?.filter((a) => !a.acknowledged).length ?? 0;

  const filtered = useMemo(
    () =>
      (patients ?? [])
        .filter((p) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          const hay = [
            p.patient_code,
            p.display_name,
            p.pod_name,
            p.bed_number,
            p.admitted_by_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
        .sort(comparePatientsByRisk),
    [patients, search]
  );

  const currentIndex = useMemo(
    () => filtered.findIndex((p) => String(p.id) === id),
    [filtered, id]
  );

  const goRelative = useCallback(
    (delta: number) => {
      if (!filtered.length || currentIndex < 0) return;
      const next = filtered[(currentIndex + delta + filtered.length) % filtered.length];
      if (!next) return;
      navigate(`/newborns/${next.id}${statusQuery}`);
    },
    [filtered, currentIndex, navigate, statusQuery]
  );

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [id]);

  // Bare /newborns → list (admin) or My Patients / home (clinical)
  useEffect(() => {
    if (id || listLoading || patientLoading) return;
    if (isAdmin) navigate("/patients", { replace: true });
    else navigate(role === "nurse" ? "/my-patients" : "/", { replace: true });
  }, [id, listLoading, patientLoading, isAdmin, role, navigate]);

  useEffect(() => {
    if (!showRail) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goRelative(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goRelative(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRail, goRelative]);

  function setRegistryStatus(next: RegistryStatus) {
    const q = next === "discharged" ? "?status=discharged" : "";
    if (id) navigate(`/newborns/${id}${q}`, { replace: true });
    else navigate(next === "discharged" ? "/patients?status=discharged" : "/patients");
  }

  if (!id) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  if (patientLoading || (isAdmin && listLoading)) {
    return (
      <AppLayout alertCount={unack}>
        <PageLoading />
      </AppLayout>
    );
  }

  const clinicalBack = role === "nurse" ? "/my-patients" : "/";

  // —— Admin chart with left patient rail ——
  if (showRail) {
    return (
      <AppLayout alertCount={unack} immersive>
        <div className="flex h-full min-h-0 flex-col gap-1.5">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                <Link to={listHref}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> List
                </Link>
              </Button>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {patient?.display_name || patient?.patient_code || "Chart"}
                </span>
                <span className="mx-1.5 text-border">·</span>
                ↑↓ / J K · {filtered.length}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 px-0"
                disabled={filtered.length < 2}
                onClick={() => goRelative(-1)}
                aria-label="Previous patient"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 px-0"
                disabled={filtered.length < 2}
                onClick={() => goRelative(1)}
                aria-label="Next patient"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {can("assessment.create") && patientId && (
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                  <Link to={`/ai-center/assess?patient=${patientId}`}>Re-assess</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="shrink-0 md:hidden">
            <select
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              value={id ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                if (next) navigate(`/newborns/${next}${statusQuery}`);
                else navigate(listHref);
              }}
            >
              <option value="">Select a patient…</option>
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_code}
                  {p.latest_assessment
                    ? ` · ${alignMortalityRisk(p.latest_assessment.mortality_tier, p.latest_assessment.mortality_probability).tier} risk`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
            <Card className="hidden h-full w-80 shrink-0 flex-col overflow-hidden xl:w-96 md:flex">
              <div className="shrink-0 space-y-3 border-b border-border p-3.5">
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 flex-1"
                    variant={registryStatus === "active" ? "default" : "outline"}
                    onClick={() => setRegistryStatus("active")}
                  >
                    Active
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 flex-1"
                    variant={registryStatus === "discharged" ? "default" : "outline"}
                    onClick={() => setRegistryStatus("discharged")}
                  >
                    Discharged
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ID, name, POD…"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3">
                {filtered.map((p) => {
                  const latest = p.latest_assessment;
                  const risk = latest
                    ? alignMortalityRisk(latest.mortality_tier, latest.mortality_probability)
                    : null;
                  const admittedBy = formatAdmittedBy(p.admitted_by_name, p.admitted_by_role);
                  const selected = String(p.id) === id;
                  return (
                    <button
                      key={p.id}
                      ref={selected ? selectedRowRef : undefined}
                      type="button"
                      onClick={() => navigate(`/newborns/${p.id}${statusQuery}`)}
                      className={cn(
                        "w-full rounded-xl border px-3.5 py-3.5 text-left transition",
                        selected
                          ? "border-primary/40 bg-accent text-accent-foreground shadow-sm ring-1 ring-primary/20"
                          : "border-border/80 bg-card hover:border-border hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-snug">
                            {p.display_name || p.patient_code}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            {p.patient_code}
                          </p>
                        </div>
                        {risk ? (
                          <MortalityBadge
                            className="shrink-0"
                            tier={risk.tier}
                            probability={risk.probability}
                          />
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            Not assessed
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {formatClinicalNumber(latest?.birth_weight ?? p.birth_weight)} kg ·{" "}
                        {latest?.gestational_age ?? p.gestational_age}w
                        {risk ? ` · ${risk.probability.toFixed(1)}%` : ""}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {p.pod_name || "No POD"}
                        {p.bed_number ? ` · Bed ${p.bed_number}` : ""}
                      </p>
                      {admittedBy && (
                        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                          {admittedBy}
                        </p>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No patients match this filter.
                  </p>
                )}
              </div>
            </Card>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {isError || !patient ? (
                <EmptyState
                  title="Patient not found"
                  description="Pick another newborn from the left list, or return to the patient list."
                  action={
                    <Button asChild>
                      <Link to={listHref}>Patient list</Link>
                    </Button>
                  }
                />
              ) : (
                <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h2 className="truncate text-base font-semibold">{patient.patient_code}</h2>
                      {patient.status && patient.status !== "active" && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                          {patient.status}
                        </span>
                      )}
                      {patient.latest_assessment && (
                        <MortalityBadge
                          tier={patient.latest_assessment.mortality_tier}
                          probability={patient.latest_assessment.mortality_probability}
                        />
                      )}
                    </div>
                    <TabsList className="h-8 min-w-0 flex-1 justify-start overflow-x-auto sm:flex-none">
                      <TabsTrigger value="overview" className="px-2.5 text-xs">
                        Profile
                      </TabsTrigger>
                      <TabsTrigger value="ai" className="px-2.5 text-xs">
                        AI Guidance
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="px-2.5 text-xs">
                        Ask AI
                      </TabsTrigger>
                      <TabsTrigger value="timeline" className="px-2.5 text-xs">
                        History
                      </TabsTrigger>
                    </TabsList>
                    <AdminPatientActions patient={patient} compact />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                    <TabsContent value="overview" className="mt-0">
                      <PatientOverview patient={patient} />
                    </TabsContent>
                    <TabsContent value="ai" className="mt-0">
                      <PatientAIInsights patient={patient} />
                    </TabsContent>
                    <TabsContent value="chat" className="mt-0">
                      <PatientChat
                        patientId={patient.id}
                        patientCode={patient.patient_code}
                        patient={patient}
                        assessmentCount={(assessments ?? []).length}
                      />
                    </TabsContent>
                    <TabsContent value="timeline" className="mt-0">
                      <PatientTimeline assessments={assessments ?? []} />
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  // —— Nurse / doctor chart (no left rail) ——
  if (isError || !patient) {
    return (
      <AppLayout alertCount={unack}>
        <PageHeader title="Patient" description="Chart not available" />
        <EmptyState
          title="Patient not found"
          description="Return to My Patients and open a chart again."
          action={
            <Button asChild>
              <Link to={clinicalBack}>Back</Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout alertCount={unack}>
      <div className="space-y-4">
        <PageHeader
          title={patient.display_name || patient.patient_code}
          description="Clinical chart"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={clinicalBack}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {role === "nurse" ? "My Patients" : "Back"}
                </Link>
              </Button>
              {can("assessment.create") && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/ai-center/assess?patient=${patient.id}`}>Re-assess</Link>
                </Button>
              )}
              {can("assessment.create") && (
                <Button size="sm" asChild>
                  <Link to="/newborns/register">Admit Newborn</Link>
                </Button>
              )}
            </div>
          }
        />

        <Card className="overflow-hidden">
          <Tabs defaultValue="overview" className="flex flex-col">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <h2 className="truncate text-base font-semibold">{patient.patient_code}</h2>
                {patient.latest_assessment && (
                  <MortalityBadge
                    tier={patient.latest_assessment.mortality_tier}
                    probability={patient.latest_assessment.mortality_probability}
                  />
                )}
              </div>
              <TabsList className="h-8 min-w-0 flex-1 justify-start overflow-x-auto sm:flex-none">
                <TabsTrigger value="overview" className="px-2.5 text-xs">
                  Profile
                </TabsTrigger>
                <TabsTrigger value="ai" className="px-2.5 text-xs">
                  AI Guidance
                </TabsTrigger>
                <TabsTrigger value="chat" className="px-2.5 text-xs">
                  Ask AI
                </TabsTrigger>
                <TabsTrigger value="timeline" className="px-2.5 text-xs">
                  History
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="p-3 sm:p-4">
              <TabsContent value="overview" className="mt-0">
                <PatientOverview patient={patient} />
              </TabsContent>
              <TabsContent value="ai" className="mt-0">
                <PatientAIInsights patient={patient} />
              </TabsContent>
              <TabsContent value="chat" className="mt-0">
                <PatientChat
                  patientId={patient.id}
                  patientCode={patient.patient_code}
                  patient={patient}
                  assessmentCount={(assessments ?? []).length}
                />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <PatientTimeline assessments={assessments ?? []} />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
}
