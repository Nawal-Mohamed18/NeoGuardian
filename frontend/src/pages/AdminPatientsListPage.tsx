import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Search, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoading } from "@/components/shared/PageLoading";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatients } from "@/hooks/usePatients";
import { usePods } from "@/hooks/usePods";
import { useAuth } from "@/context/AuthContext";
import { comparePatientsByRisk, formatClinicalNumber } from "@/lib/risk";
import { cn, formatAdmittedBy } from "@/lib/utils";
import type { Patient } from "@/types";

type StatusFilter = "active" | "discharged";
type PodFilter = "all" | string;

/**
 * Admin-only census: nurse-style patient cards, filterable by POD.
 */
export default function AdminPatientsListPage() {
  const { role, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const statusFilter: StatusFilter =
    searchParams.get("status") === "discharged" ? "discharged" : "active";
  const [podFilter, setPodFilter] = useState<PodFilter>("all");
  const [podMenuOpen, setPodMenuOpen] = useState(false);
  const podMenuRef = useRef<HTMLDivElement>(null);

  const { data: patients = [], isLoading } = usePatients({ status: statusFilter });
  const { data: pods = [] } = usePods();

  useEffect(() => {
    if (!podMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!podMenuRef.current?.contains(e.target as Node)) setPodMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [podMenuOpen]);

  function setStatusFilter(next: StatusFilter) {
    if (next === "discharged") setSearchParams({ status: "discharged" });
    else setSearchParams({});
  }

  const podOptions = useMemo(() => {
    const fromApi = (pods ?? [])
      .map((p) => p.name?.trim())
      .filter(Boolean) as string[];
    const fromPatients = (patients as Patient[])
      .map((p) => p.pod_name?.trim())
      .filter(Boolean) as string[];
    return Array.from(new Set([...fromApi, ...fromPatients])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [pods, patients]);

  const scoped = useMemo(() => {
    let list = [...(patients as Patient[])];
    if (podFilter !== "all") {
      list = list.filter(
        (p) => (p.pod_name || "").trim().toLowerCase() === podFilter.toLowerCase()
      );
    }
    return list.sort(comparePatientsByRisk);
  }, [patients, podFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) => {
      const tier = p.latest_assessment?.mortality_tier?.toLowerCase() ?? "";
      const haystack = [
        p.display_name,
        p.patient_code,
        p.pod_name,
        p.bed_number,
        p.admitted_by_name,
        p.admitted_by_role,
        tier,
        tier ? `${tier} risk` : "",
        p.gestational_age != null ? `${p.gestational_age}w` : "",
        p.birth_weight != null ? `${formatClinicalNumber(p.birth_weight)} kg` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [scoped, search]);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      {isLoading ? (
        <PageLoading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Patients</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                All units · filter by POD · click to open chart
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-md sm:flex-1 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, ID, bed, POD, or risk..."
                  className="h-9 bg-card pl-9"
                  aria-label="Search patients"
                />
              </div>
              {can("assessment.create") && (
                <Button asChild className="w-full shrink-0 sm:w-auto">
                  <Link to="/newborns/register">
                    <UserPlus className="mr-1 h-4 w-4" /> Admit Newborn
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={statusFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "discharged" ? "default" : "outline"}
              onClick={() => setStatusFilter("discharged")}
            >
              Discharged
            </Button>
            <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
            <div className="relative" ref={podMenuRef}>
              <button
                type="button"
                className="inline-flex h-8 min-w-36 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
                aria-label="Filter by POD"
                aria-expanded={podMenuOpen}
                onClick={() => setPodMenuOpen((o) => !o)}
              >
                <span className="truncate">{podFilter === "all" ? "All PODs" : podFilter}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", podMenuOpen && "rotate-180")} />
              </button>
              {podMenuOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 top-full z-40 mt-1 max-h-56 min-w-full overflow-y-auto rounded-md border border-border bg-card py-1 text-xs shadow-lg"
                >
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={podFilter === "all"}
                      className={cn(
                        "flex w-full px-2.5 py-1.5 text-left hover:bg-muted",
                        podFilter === "all" && "bg-muted font-medium"
                      )}
                      onClick={() => {
                        setPodFilter("all");
                        setPodMenuOpen(false);
                      }}
                    >
                      All PODs
                    </button>
                  </li>
                  {podOptions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={podFilter === name}
                        className={cn(
                          "flex w-full px-2.5 py-1.5 text-left hover:bg-muted",
                          podFilter === name && "bg-muted font-medium"
                        )}
                        onClick={() => {
                          setPodFilter(name);
                          setPodMenuOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {filtered.length} shown
            </span>
          </div>

          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const admittedBy = formatAdmittedBy(p.admitted_by_name, p.admitted_by_role);
              return (
                <Link
                  key={p.id}
                  to={`/newborns/${p.id}${statusFilter === "discharged" ? "?status=discharged" : ""}`}
                  className="flex h-full min-h-0 min-w-0"
                >
                  <Card className="flex h-full min-w-0 w-full flex-col p-4 transition hover:border-teal-200 hover:shadow-md">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate font-semibold leading-snug">
                        {p.display_name || p.patient_code}
                      </h3>
                      {p.latest_assessment ? (
                        <MortalityBadge
                          className="shrink-0 whitespace-nowrap"
                          tier={p.latest_assessment.mortality_tier}
                          probability={p.latest_assessment.mortality_probability}
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {p.patient_code} · {p.pod_name || "No POD"} · Bed {p.bed_number || "—"}
                    </p>
                    <div className="mt-auto border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground">
                        {p.gestational_age}w · {formatClinicalNumber(p.birth_weight)} kg
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {admittedBy ?? "Admitted by not recorded"}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
            {scoped.length === 0 && (
              <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                {podFilter === "all"
                  ? `No ${statusFilter} patients in the registry.`
                  : `No ${statusFilter} patients in ${podFilter}.`}
              </Card>
            )}
            {scoped.length > 0 && filtered.length === 0 && (
              <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                No patients match “{search.trim()}”.
              </Card>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
