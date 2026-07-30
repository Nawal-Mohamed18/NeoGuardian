import { useEffect, useMemo, useState } from "react";

/** Bump every `intervalMs` so charts remount and replay entrance animation. */
export function useChartLiveTick(intervalMs = 5000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/** Remount/animate charts when underlying server data actually changes. */
export function useChartDataSignature(data: unknown): string {
  return useMemo(() => JSON.stringify(data), [data]);
}

export function formatChartDay(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [, month, day] = iso.split("-");
  return `${month}/${day}`;
}

/** Format YYYY-MM as e.g. Jul 26 */
export function formatChartMonth(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

/** Soft clinical palette — readable meaning, balanced saturation. */
export const RISK_COLORS = {
  High: "#f87171",
  Moderate: "#fbbf24",
  Low: "#2dd4bf",
} as const;

export const RISK_PIE_COLORS: Record<string, string> = {
  High: RISK_COLORS.High,
  Moderate: RISK_COLORS.Moderate,
  Low: RISK_COLORS.Low,
};

export const CHART_TEAL = "#5eead4";
export const CHART_HR = "#fb7185";
