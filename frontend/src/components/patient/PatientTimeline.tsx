import { Card, CardContent } from "@/components/ui/card";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { alignMortalityRisk } from "@/lib/risk";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

function isNeutralFactor(factor: string) {
  const lower = factor.toLowerCase();
  return (
    lower.includes("within expected ranges") ||
    lower.includes("term infant") ||
    lower.includes("no major risk factors") ||
    lower.includes("bedside vitals")
  );
}

export function PatientTimeline({ assessments }: { assessments: Assessment[] }) {
  if (!assessments.length) {
    return (
      <EmptyState
        title="No assessments yet"
        description="Run a new assessment to build this patient's history."
      />
    );
  }

  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
      {assessments.map((a, i) => {
        const risk = alignMortalityRisk(a.mortality_tier, a.mortality_probability);
        const weightKg = a.current_weight ?? a.birth_weight;
        const isAdmission = i === assessments.length - 1;
        const factors = (a.mortality_factors ?? []).filter((f) => !isNeutralFactor(f)).slice(0, 4);

        return (
          <div key={a.id} className="relative">
            <div className="absolute -left-4 top-4 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Assessment #{assessments.length - i}
                      {i === 0 && assessments.length > 1 ? " · latest" : ""}
                      {isAdmission ? " · admission" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">
                          {isAdmission ? "Birth weight" : "Weight used"}
                        </dt>
                        <dd className="font-medium text-foreground">{weightKg} kg</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">GA</dt>
                        <dd className="font-medium text-foreground">{a.gestational_age}w</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Apgar</dt>
                        <dd className="font-medium text-foreground">
                          <span className="tabular-nums">{a.apgar_1min ?? "—"}</span>
                          <span className="text-muted-foreground"> at 1 min</span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <span className="tabular-nums">{a.apgar_5min ?? "—"}</span>
                          <span className="text-muted-foreground"> at 5 min</span>
                        </dd>
                      </div>
                      {a.spo2 != null ? (
                        <div>
                          <dt className="text-muted-foreground">SpO₂</dt>
                          <dd className="font-medium text-foreground">{a.spo2}%</dd>
                        </div>
                      ) : null}
                      {a.heart_rate != null ? (
                        <div>
                          <dt className="text-muted-foreground">HR</dt>
                          <dd className="font-medium text-foreground">{a.heart_rate}</dd>
                        </div>
                      ) : null}
                      {a.temperature != null ? (
                        <div>
                          <dt className="text-muted-foreground">Temp</dt>
                          <dd className="font-medium text-foreground">{a.temperature}°C</dd>
                        </div>
                      ) : null}
                      {a.respiratory_rate != null ? (
                        <div>
                          <dt className="text-muted-foreground">RR</dt>
                          <dd className="font-medium text-foreground">{a.respiratory_rate}</dd>
                        </div>
                      ) : null}
                      {a.blood_glucose != null ? (
                        <div>
                          <dt className="text-muted-foreground">Glucose</dt>
                          <dd className="font-medium text-foreground">{a.blood_glucose}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                  <div className="shrink-0 text-right">
                    <MortalityBadge tier={risk.tier} />
                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {risk.probability.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">28-day risk</p>
                  </div>
                </div>

                {factors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {factors.map((f) => (
                      <span
                        key={f}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          "bg-muted text-muted-foreground"
                        )}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
