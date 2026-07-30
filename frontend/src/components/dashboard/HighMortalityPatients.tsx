import { AlertTriangle, ChevronRight, ShieldAlert } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { MortalityBadge, MortalityGauge } from "@/components/mortality/MortalityGauge";
import { alignMortalityRisk } from "@/lib/risk";
import { useAuth } from "@/context/AuthContext";
import { maskName } from "@/lib/roles";
import type { MortalityTier } from "@/types";

function initials(code: string) {
  return code.replace(/[^A-Z0-9]/gi, "").slice(-2).toUpperCase() || "NB";
}

export interface HighMortalityPatientsProps {
  patients: Array<{
    id: number;
    patient_code: string;
    birth_weight: number;
    gestational_age: number;
    mortality_probability: number;
    mortality_tier: MortalityTier;
    intervention_window: string;
  }>;
}

export function HighMortalityPatients({ patients }: HighMortalityPatientsProps) {
  const { canViewPHI } = useAuth();

  return (
    <SectionCard
      title="High Risk Patients"
      icon={AlertTriangle}
      iconClassName="text-red-500 dark:text-red-400"
      viewAllHref="/newborns"
      viewAllLabel="All newborns"
      bodyClassName="p-2"
      className="h-full"
    >
      {patients.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/45">
            <ShieldAlert className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-foreground">No elevated risk cases</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Run assessments on admissions to populate this list.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {patients.map((p) => {
            const displayName = maskName(`Baby ${p.patient_code}`, p.patient_code, canViewPHI);
            const risk = alignMortalityRisk(p.mortality_tier, p.mortality_probability);
            return (
              <li key={p.id}>
                <Link
                  to={`/newborns/${p.id}`}
                  className="flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-red-50/40 dark:hover:bg-red-950/30"
                >
                  <Avatar className="h-10 w-10 border border-red-100 dark:border-red-500/30">
                    <AvatarFallback className="bg-red-50 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      {canViewPHI ? initials(p.patient_code) : "NB"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <MortalityBadge tier={risk.tier} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.patient_code} · GA {p.gestational_age}w · BW {p.birth_weight} kg
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-red-600/90 dark:text-red-300/90">{p.intervention_window}</p>
                  </div>
                  <div className="hidden w-28 shrink-0 sm:block">
                    <MortalityGauge
                      probability={risk.probability}
                      tier={risk.tier}
                      size="sm"
                      showLabel={false}
                    />
                  </div>
                  <div className="sm:hidden text-right">
                    <p className="text-lg font-bold text-red-600 dark:text-red-300">{risk.probability.toFixed(1)}%</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
