import { ClinicalAwarenessPanel } from "@/components/ai/ClinicalAwarenessPanel";
import { ClinicalContextFactors } from "@/components/clinical/ClinicalContextFactors";
import { IncompleteDataBanner } from "@/components/clinical/IncompleteDataBanner";
import { ModelInformationCard } from "@/components/clinical/ModelInformationCard";
import { OptionalClinicalValue } from "@/components/clinical/OptionalClinicalValue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MortalityGauge, MortalityBadge } from "@/components/mortality/MortalityGauge";
import { resolveModelInformation } from "@/lib/modelInfo";
import { alignMortalityRisk, formatClinicalNumber, formatRiskPercent } from "@/lib/risk";
import { formatAdmittedBy, formatDateTime } from "@/lib/utils";
import type { Patient } from "@/types";

function latestRunLabel(modelUsed?: string | null): string {
  const id = (modelUsed || "").toLowerCase();
  if (id.includes("assessment")) return "Latest re-assessment model run";
  if (id.includes("balanced_random_forest") || id.includes("admit")) {
    return "Latest admission model run";
  }
  return "Latest model run";
}

export function PatientOverview({ patient }: { patient: Patient }) {
  const latest = patient.latest_assessment;
  const risk = latest
    ? alignMortalityRisk(latest.mortality_tier, latest.mortality_probability)
    : null;
  const awareness = latest?.clinical_awareness;
  const currentWeight =
    patient.current_weight ??
    latest?.current_weight ??
    latest?.birth_weight ??
    patient.birth_weight;
  const admittedBy = formatAdmittedBy(patient.admitted_by_name, patient.admitted_by_role);
  const runLabel = latestRunLabel(latest?.model_used);
  const modelInfo = resolveModelInformation(latest?.model_used);

  const snapshot = {
    blood_glucose: latest?.blood_glucose,
    temperature: latest?.temperature,
    spo2: latest?.spo2,
    respiratory_rate: latest?.respiratory_rate,
    heart_rate: latest?.heart_rate,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Admission Data</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-stretch">
            {[
              ["Gender", patient.gender],
              ["Birth Weight", `${formatClinicalNumber(patient.birth_weight)} kg`],
              ["Current Weight", `${formatClinicalNumber(currentWeight)} kg`],
              ["Gestational Age", `${patient.gestational_age} weeks`],
              ["Mother Age", `${patient.mother_age} years`],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex min-w-0 flex-col justify-center rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5 sm:flex-1 sm:basis-0"
              >
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {patient.maternal && (
            <div className="mt-3 rounded-xl border border-border/80 bg-muted/15 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Maternal history (from admission)</p>
              <p className="mt-1">
                ANC visits: {patient.maternal.anc_visits}
                {" · "}
                Hypertension: {patient.maternal.hypertension ? "Yes" : "No"}
                {" · "}
                Gestational diabetes: {patient.maternal.gestational_diabetes ? "Yes" : "No"}
                {patient.delivery_type
                  ? ` · Delivery: ${patient.delivery_type.replace(/_/g, " ")}`
                  : ""}
              </p>
            </div>
          )}
          {admittedBy ? (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{admittedBy}</span>
              {patient.admission_date ? ` · ${formatDateTime(patient.admission_date)}` : ""}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Admitted by not recorded</p>
          )}
          {latest && (
            <p className="mt-3 text-xs text-muted-foreground">
              Blood glucose:{" "}
              <OptionalClinicalValue value={latest.blood_glucose} unit="mg/dL" />
            </p>
          )}
        </CardContent>
      </Card>

      {latest ? <IncompleteDataBanner snapshot={snapshot} /> : null}

      {awareness ? <ClinicalAwarenessPanel awareness={awareness} /> : null}

      {latest && !awareness && (
        <Card className="border-teal-100">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>28-Day Risk Estimate</CardTitle>
            <MortalityBadge tier={risk!.tier} />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {runLabel} · {modelInfo.modelName}
            </p>
            <dl className="space-y-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Estimated Mortality Risk</dt>
                <dd className="font-semibold tabular-nums">
                  {formatRiskPercent(latest.mortality_probability)}%
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Risk Tier</dt>
                <dd className="font-semibold">{risk!.tier}</dd>
              </div>
            </dl>
            <MortalityGauge
              probability={latest.mortality_probability}
              tier={risk!.tier}
              confidence={latest.model_confidence}
            />
            <p className="text-sm font-medium text-foreground">{latest.intervention_window}</p>
            <ClinicalContextFactors
              factors={latest.mortality_factors}
              trajectory={awareness?.trajectory}
            />
            <p className="text-sm leading-relaxed text-muted-foreground">{latest.ai_summary}</p>
            <ModelInformationCard runtimeModelUsed={latest.model_used} />
          </CardContent>
        </Card>
      )}

      {latest && awareness ? (
        <Card>
          <CardHeader>
            <CardTitle>Care note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {runLabel} · {modelInfo.modelName}
              {latest.created_at ? ` · ${formatDateTime(latest.created_at)}` : ""}
            </p>
            <p className="text-sm font-medium text-foreground">{latest.intervention_window}</p>
            <ClinicalContextFactors
              factors={latest.mortality_factors}
              trajectory={awareness.trajectory}
            />
            <p className="text-sm leading-relaxed text-muted-foreground">{latest.ai_summary}</p>
            <ModelInformationCard runtimeModelUsed={latest.model_used} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
