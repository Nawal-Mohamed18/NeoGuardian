import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeMortalityTier } from "@/lib/roles";
import { alignMortalityRisk, tierFromProbability } from "@/lib/risk";
import type { MortalityTier } from "@/types";

export { tierFromProbability };

const TIER_STYLES: Record<MortalityTier, { bar: string; text: string; bg: string; label: string }> = {
  High: {
    bar: "bg-red-600 dark:bg-red-500",
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/50",
    label: "High risk",
  },
  Moderate: {
    bar: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/45",
    label: "Moderate risk",
  },
  Low: {
    bar: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/45",
    label: "Low risk",
  },
};

interface MortalityGaugeProps {
  probability: number;
  tier?: MortalityTier | string;
  confidence?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** Count risk % up from 0 and grow the bar. */
  animate?: boolean;
  className?: string;
}

function useAnimatedNumber(target: number, enabled: boolean, durationMs = 1100) {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    setValue(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);
  return value;
}

export function MortalityGauge({
  probability,
  tier,
  confidence,
  size = "md",
  showLabel = true,
  animate = false,
  className,
}: MortalityGaugeProps) {
  // Probability is authoritative — tier badge must match the % shown
  const resolvedTier = alignMortalityRisk(tier ?? tierFromProbability(probability), probability).tier;
  const displayProbability = useAnimatedNumber(probability, animate);
  const displayConfidence = useAnimatedNumber(confidence ?? 0, animate && confidence !== undefined);
  const style = TIER_STYLES[resolvedTier];
  const pct = Math.min(Math.max(displayProbability, 0), 35);
  const barWidth = `${(pct / 35) * 100}%`;

  const sizeClasses = {
    sm: { value: "text-2xl", bar: "h-2", wrap: "gap-2" },
    md: { value: "text-4xl", bar: "h-2.5", wrap: "gap-3" },
    lg: { value: "text-5xl", bar: "h-3", wrap: "gap-4" },
  }[size];

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex items-end justify-between", sizeClasses.wrap)}>
        <div>
          <p className={cn("font-bold tabular-nums tracking-tight", sizeClasses.value, style.text)}>
            {displayProbability.toFixed(1)}
            <span className="text-[0.45em] font-semibold text-muted-foreground">%</span>
          </p>
          {showLabel && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Clinical risk estimate
            </p>
          )}
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide", style.bg, style.text)}>
          {style.label}
        </span>
      </div>
      <div className={cn("mt-3 w-full overflow-hidden rounded-full bg-muted", sizeClasses.bar)}>
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", style.bar)}
          style={{ width: barWidth }}
        />
      </div>
      {confidence !== undefined && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Data completeness: {Math.round(displayConfidence * 100)}%
        </p>
      )}
    </div>
  );
}

export function MortalityBadge({
  tier,
  probability,
  className,
}: {
  tier: MortalityTier | string;
  probability?: number;
  className?: string;
}) {
  const resolved =
    typeof probability === "number"
      ? alignMortalityRisk(tier, probability).tier
      : normalizeMortalityTier(tier);
  const style = TIER_STYLES[resolved];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.bg, style.text, className)}>
      {style.label}
    </span>
  );
}
