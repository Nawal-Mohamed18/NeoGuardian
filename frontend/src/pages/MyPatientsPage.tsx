import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoading } from "@/components/shared/PageLoading";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatients } from "@/hooks/usePatients";
import { useAuth } from "@/context/AuthContext";
import { assignedPodsFromUser, scopePatientsForRole } from "@/lib/podScope";
import { comparePatientsByRisk, formatClinicalNumber } from "@/lib/risk";
import { formatAdmittedBy } from "@/lib/utils";
import type { Patient } from "@/types";

export default function MyPatientsPage() {
  const { user, can } = useAuth();
  const [search, setSearch] = useState("");
  const assignedPods = useMemo(() => assignedPodsFromUser(user), [user]);
  const { data: patients = [], isLoading } = usePatients();

  const myPatients = useMemo(
    () =>
      scopePatientsForRole(patients as Patient[], {
        role: user?.profile?.role ?? user?.role,
        assignedPods,
      }).sort(comparePatientsByRisk),
    [patients, assignedPods, user]
  );

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myPatients;
    return myPatients.filter((p) => {
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
  }, [myPatients, search]);

  const unitLabel =
    assignedPods.length === 0
      ? "No POD assigned"
      : assignedPods.length === 1
        ? `Assigned to ${assignedPods[0]}`
        : `Assigned to ${assignedPods.join(" · ")}`;

  return (
    <AppLayout>
      {isLoading ? (
        <PageLoading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 shrink-0">
              <h1 className="text-2xl font-bold tracking-tight">My Patients</h1>
              <p className="text-sm text-muted-foreground">
                {unitLabel} · click to open profile
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-4">
              <div className="relative w-full min-w-[12rem] max-w-md flex-1">
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
                <Button asChild className="shrink-0">
                  <Link to="/newborns/register">
                    <UserPlus className="mr-1 h-4 w-4" /> Admit Newborn
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((p) => {
              const admittedBy = formatAdmittedBy(p.admitted_by_name, p.admitted_by_role);
              return (
              <Link key={p.id} to={`/newborns/${p.id}`} className="flex h-full min-h-0 min-w-0">
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
            {myPatients.length === 0 && (
              <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                {assignedPods.length === 0
                  ? "No POD assigned to your account. Ask an admin to assign you to a unit."
                  : `No active patients in your assigned unit${assignedPods.length > 1 ? "s" : ""} yet.`}
              </Card>
            )}
            {myPatients.length > 0 && filteredPatients.length === 0 && (
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
