import { motion } from "framer-motion";
import { AlertCircle, Clock } from "lucide-react";
import { ClinicalAwarenessPanel } from "@/components/ai/ClinicalAwarenessPanel";
import { ClinicalContextFactors } from "@/components/clinical/ClinicalContextFactors";
import { IncompleteDataBanner } from "@/components/clinical/IncompleteDataBanner";
import { ModelInformationCard } from "@/components/clinical/ModelInformationCard";
import { MortalityBadge, MortalityGauge } from "@/components/mortality/MortalityGauge";
import { Button } from "@/components/ui/button";
import type { ClinicalSnapshot } from "@/lib/missingClinicalData";
import { alignMortalityRisk } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { Assessment, ClinicalAwareness, LatestAssessment } from "@/types";

type ResultLike = Pick<
  LatestAssessment,
  | "mortality_probability"
  | "mortality_tier"
  | "model_confidence"
  | "model_used"
  | "intervention_window"
  | "mortality_factors"
  | "ai_summary"
  | "ai_recommendations"
> & {
  patient?: number;
  patient_code?: string;
  clinical_awareness?: ClinicalAwareness;
  temperature?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  blood_glucose?: number | null;
};

type AiResultsRevealProps = {
  result: ResultLike | Assessment;
  patientCode?: string;
  onOpenChart?: () => void;
  openChartLabel?: string;
  className?: string;
  /** Optional explicit snapshot; otherwise derived from result vitals when present. */
  clinicalSnapshot?: ClinicalSnapshot;
};

export function AiResultsReveal({
  result,
  patientCode,
  onOpenChart,
  openChartLabel = "Open Clinical Profile",
  className,
  clinicalSnapshot,
}: AiResultsRevealProps) {
  const code = patientCode || ("patient_code" in result ? result.patient_code : undefined);
  const awareness = result.clinical_awareness;
  const risk = alignMortalityRisk(result.mortality_tier, result.mortality_probability);
  const snapshot: ClinicalSnapshot = clinicalSnapshot ?? {
    blood_glucose: result.blood_glucose,
    temperature: result.temperature,
    spo2: result.spo2,
    respiratory_rate: result.respiratory_rate,
    heart_rate: result.heart_rate,
  };

  return (
    <motion.div
      className={cn("space-y-5", className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12 } },
      }}
    >
      <motion.div variants={item}>
        <IncompleteDataBanner snapshot={snapshot} />
      </motion.div>

      {awareness ? (
        <motion.div variants={item}>
          <ClinicalAwarenessPanel awareness={awareness} />
        </motion.div>
      ) : (
        <motion.div
          variants={item}
          className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-card-foreground">{code}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Estimated Mortality Risk</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {risk.probability.toFixed(1)}%
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Risk Tier</dt>
                  <dd className="font-semibold text-foreground">{risk.tier}</dd>
                </div>
              </dl>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 18 }}
            >
              <MortalityBadge
                tier={risk.tier}
                probability={risk.probability}
                className="shadow-sm ring-2 ring-border"
              />
            </motion.div>
          </div>
          <div className="mt-5">
            <MortalityGauge
              probability={risk.probability}
              tier={risk.tier}
              confidence={result.model_confidence}
              size="lg"
              animate
            />
          </div>
        </motion.div>
      )}

      {result.intervention_window && (
        <motion.div
          variants={item}
          className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>
            <strong>Intervention window:</strong> {result.intervention_window}
          </span>
        </motion.div>
      )}

      {!awareness && result.mortality_factors?.length > 0 && (
        <motion.div variants={item}>
          <ClinicalContextFactors
            factors={result.mortality_factors}
            trajectory={result.clinical_awareness?.trajectory}
          />
        </motion.div>
      )}

      {awareness && (result.mortality_factors?.length > 0 || awareness.trajectory?.message) && (
        <motion.div variants={item}>
          <ClinicalContextFactors
            factors={result.mortality_factors}
            trajectory={awareness.trajectory}
          />
        </motion.div>
      )}

      {result.ai_summary && (
        <motion.p variants={item} className="text-sm leading-relaxed text-foreground">
          {result.ai_summary}
        </motion.p>
      )}

      {result.ai_recommendations?.length > 0 && (
        <motion.div variants={item}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Care recommendations
          </p>
          <ul className="space-y-2">
            {result.ai_recommendations.map((r, i) => (
              <motion.li
                key={r}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + i * 0.08 }}
                className="flex gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm text-card-foreground shadow-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {r}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div variants={item}>
        <ModelInformationCard runtimeModelUsed={result.model_used} />
      </motion.div>

      {onOpenChart && (
        <motion.div variants={item}>
          <Button className="w-full" onClick={onOpenChart}>
            {openChartLabel}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};
