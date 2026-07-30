import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { alignMortalityRisk, formatRiskPercent } from "@/lib/risk";
import type { ClinicalAwareness, MortalityTier } from "@/types";

const TIER_TONE: Record<
  MortalityTier,
  { bar: string; soft: string; text: string; ring: string }
> = {
  High: {
    bar: "bg-red-500",
    soft: "bg-red-500/10",
    text: "text-red-700 dark:text-red-300",
    ring: "ring-red-500/25",
  },
  Moderate: {
    bar: "bg-amber-500",
    soft: "bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-200",
    ring: "ring-amber-500/25",
  },
  Low: {
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/10",
    text: "text-emerald-800 dark:text-emerald-200",
    ring: "ring-emerald-500/25",
  },
};

function ScoreMeter({
  title,
  subtitle,
  value,
  tier,
  emphasize,
}: {
  title?: string;
  subtitle?: string;
  value: number;
  tier: MortalityTier;
  emphasize?: boolean;
}) {
  const aligned = alignMortalityRisk(tier, value);
  const tone = TIER_TONE[aligned.tier];
  const width = `${Math.min(100, Math.max(4, (aligned.probability / 40) * 100))}%`;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm",
        emphasize && "ring-2 ring-teal-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {(title || subtitle) ? (
          <div className="min-w-0">
            {title ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {title}
              </p>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1",
            tone.soft,
            tone.text,
            tone.ring
          )}
        >
          {aligned.tier}
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className={cn("text-3xl font-bold tabular-nums tracking-tight", tone.text)}>
          {formatRiskPercent(aligned.probability)}
        </span>
        <span className="mb-1 text-xs font-medium text-muted-foreground">%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", tone.bar)}
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

type ClinicalAwarenessPanelProps = {
  awareness: ClinicalAwareness;
  className?: string;
  compact?: boolean;
};

/** Model-only view: current 28-day risk vs admission baseline. */
export function ClinicalAwarenessPanel({
  awareness,
  className,
}: ClinicalAwarenessPanelProps) {
  const isReassess = awareness.trajectory.direction !== "baseline";

  return (
    <motion.section
      className={cn("space-y-4", className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="overflow-hidden rounded-3xl border border-teal-500/20 bg-linear-to-br from-teal-500/8 via-card to-sky-500/6 p-4 shadow-sm sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 dark:text-teal-200">
            28-day mortality risk
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {isReassess ? "Current risk vs admission" : "Admission risk"}
          </h3>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ScoreMeter
            title="Current risk"
            value={awareness.current_estimate.probability ?? 0}
            tier={awareness.current_estimate.tier}
            emphasize
          />
          <ScoreMeter
            title="Admission baseline"
            value={awareness.baseline.probability ?? 0}
            tier={awareness.baseline.tier}
          />
        </div>
      </div>
    </motion.section>
  );
}
