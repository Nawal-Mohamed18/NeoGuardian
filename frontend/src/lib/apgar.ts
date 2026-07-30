/** Standard APGAR component scores (0–2 each). Sum = total APGAR (0–10). */

export type ApgarComponentKey =
  | "appearance"
  | "pulse"
  | "grimace"
  | "activity"
  | "respiration";

/** null = not yet scored (avoids looking like an intentional Apgar 0). */
export type ApgarScoreValue = 0 | 1 | 2 | null;

export type ApgarComponents = Record<ApgarComponentKey, ApgarScoreValue>;

export const APGAR_COMPONENT_META: {
  key: ApgarComponentKey;
  letter: string;
  label: string;
  short: string;
  scores: [string, string, string];
}[] = [
  {
    key: "appearance",
    letter: "A",
    label: "Appearance",
    short: "Skin color",
    scores: ["Blue / pale", "Body pink, extremities blue", "Completely pink"],
  },
  {
    key: "pulse",
    letter: "P",
    label: "Pulse",
    short: "Heart rate",
    scores: ["Absent", "< 100 bpm", "≥ 100 bpm"],
  },
  {
    key: "grimace",
    letter: "G",
    label: "Grimace",
    short: "Reflex irritability",
    scores: ["No response", "Grimace / weak cry", "Cry / withdraw"],
  },
  {
    key: "activity",
    letter: "A",
    label: "Activity",
    short: "Muscle tone",
    scores: ["Limp", "Some flexion", "Active motion"],
  },
  {
    key: "respiration",
    letter: "R",
    label: "Respiration",
    short: "Breathing",
    scores: ["Absent", "Weak / irregular", "Good / crying"],
  },
];

export function emptyApgarComponents(): ApgarComponents {
  return {
    appearance: null,
    pulse: null,
    grimace: null,
    activity: null,
    respiration: null,
  };
}

export function isApgarComplete(components: ApgarComponents): boolean {
  return APGAR_COMPONENT_META.every((m) => components[m.key] != null);
}

/** Returns null until every component is scored. */
export function sumApgar(components: ApgarComponents): number | null {
  if (!isApgarComplete(components)) return null;
  return (
    (components.appearance as 0 | 1 | 2) +
    (components.pulse as 0 | 1 | 2) +
    (components.grimace as 0 | 1 | 2) +
    (components.activity as 0 | 1 | 2) +
    (components.respiration as 0 | 1 | 2)
  );
}

export function scoredApgarCount(components: ApgarComponents): number {
  return APGAR_COMPONENT_META.filter((m) => components[m.key] != null).length;
}

export function apgarTone(total: number | null): "empty" | "critical" | "moderate" | "good" {
  if (total == null) return "empty";
  if (total <= 3) return "critical";
  if (total <= 6) return "moderate";
  return "good";
}

/** Prefer structured components; fall back to a total if only that exists. */
export function resolveApgarTotal(
  components: ApgarComponents | null | undefined,
  fallbackTotal?: number | null
): number | null {
  if (components) {
    const s = sumApgar(components);
    if (s != null) return s;
  }
  if (fallbackTotal == null || Number.isNaN(Number(fallbackTotal))) return null;
  return Number(fallbackTotal);
}
