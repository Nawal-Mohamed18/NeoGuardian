import { cn } from "@/lib/utils";
import type { ClinicalAwareness } from "@/types";

type ClinicalContextFactorsProps = {
  factors: string[];
  className?: string;
  /** Override heading — e.g. drivers from the latest admit/assess model run. */
  title?: string;
  /** Optional reassess trajectory (improved / worsened vs previous run). */
  trajectory?: ClinicalAwareness["trajectory"] | null;
};

/**
 * Factors saved with the latest model run (admit or re-assessment).
 */
export function ClinicalContextFactors({
  factors,
  className,
  title = "Drivers from latest model run",
  trajectory,
}: ClinicalContextFactorsProps) {
  if (!factors?.length && !trajectory?.message) return null;

  const direction = trajectory?.direction;
  const showChange =
    trajectory &&
    direction &&
    direction !== "baseline" &&
    Boolean(trajectory.message);

  const tone =
    direction === "improving"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
      : direction === "worsening"
        ? "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100"
        : "border-border bg-muted/40 text-foreground";

  return (
    <div className={cn("space-y-2", className)}>
      {showChange ? (
        <div className={cn("rounded-xl border px-3 py-2.5 text-sm leading-relaxed", tone)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            {direction === "improving"
              ? "Condition improved"
              : direction === "worsening"
                ? "Condition worsened"
                : "Condition stable"}
          </p>
          <p className="mt-1">{trajectory.message}</p>
          {direction === "improving" && trajectory.improved_factors?.length ? (
            <ul className="mt-2 space-y-1 text-xs opacity-90">
              {trajectory.improved_factors.slice(0, 3).map((f) => (
                <li key={`imp-${f}`}>• Eased: {f}</li>
              ))}
            </ul>
          ) : null}
          {direction === "worsening" && trajectory.worsened_factors?.length ? (
            <ul className="mt-2 space-y-1 text-xs opacity-90">
              {trajectory.worsened_factors.slice(0, 3).map((f) => (
                <li key={`wors-${f}`}>• New/worse: {f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {factors?.length ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <ul className="space-y-1.5">
            {factors.map((factor) => (
              <li
                key={factor}
                className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
              >
                • {factor}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
