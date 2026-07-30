import { useEffect, useMemo, useState } from "react";
import {
  APGAR_COMPONENT_META,
  apgarTone,
  scoredApgarCount,
  sumApgar,
  type ApgarComponents,
  type ApgarComponentKey,
  type ApgarScoreValue,
} from "@/lib/apgar";
import { cn } from "@/lib/utils";

type ApgarCalculatorProps = {
  label: string;
  value: ApgarComponents;
  onChange: (next: ApgarComponents) => void;
  disabled?: boolean;
  className?: string;
};

/** Longest "N — description" option across all criteria (for select width). */
function longestOptionLabel(): string {
  let longest = "Score…";
  for (const meta of APGAR_COMPONENT_META) {
    meta.scores.forEach((desc, score) => {
      const label = `${score} — ${desc}`;
      if (label.length > longest.length) longest = label;
    });
  }
  return longest;
}

/**
 * Compact guided APGAR: letter chips + bubble select showing "N — description".
 * Width is sized to the longest option so text never crashes the caret.
 */
export function ApgarCalculator({
  label,
  value,
  onChange,
  disabled,
  className,
}: ApgarCalculatorProps) {
  const firstUnscored = APGAR_COMPONENT_META.findIndex((m) => value[m.key] == null);
  const [activeIndex, setActiveIndex] = useState(
    firstUnscored >= 0 ? firstUnscored : 0
  );

  useEffect(() => {
    const idx = APGAR_COMPONENT_META.findIndex((m) => value[m.key] == null);
    if (idx >= 0) setActiveIndex(idx);
  }, []); // seed on mount only

  const total = sumApgar(value);
  const scored = scoredApgarCount(value);
  const tone = apgarTone(total);
  const active = APGAR_COMPONENT_META[activeIndex];
  const activeScore = value[active.key];
  const selectId = `apgar-score-${active.key}-${label.replace(/\s+/g, "-")}`;

  const selectMinCh = useMemo(() => {
    // +2 for caret / padding comfort inside the bubble
    return Math.min(42, longestOptionLabel().length + 2);
  }, []);

  function setComponent(key: ApgarComponentKey, score: 0 | 1 | 2) {
    const next = { ...value, [key]: score as ApgarScoreValue };
    onChange(next);
    const nextBlank = APGAR_COMPONENT_META.findIndex(
      (m, i) => i > activeIndex && next[m.key] == null
    );
    if (nextBlank >= 0) {
      setActiveIndex(nextBlank);
    } else if (activeIndex < APGAR_COMPONENT_META.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  }

  function onSelectChange(raw: string) {
    if (raw === "") return;
    const score = Number(raw);
    if (score === 0 || score === 1 || score === 2) {
      setComponent(active.key, score);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">
            {scored}/5 · tap letter, then pick score
          </p>
        </div>
        <div
          className={cn(
            "inline-flex items-baseline gap-0.5 rounded-lg px-2 py-1 tabular-nums",
            tone === "good" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            tone === "moderate" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            tone === "critical" && "bg-red-500/10 text-red-700 dark:text-red-300",
            tone === "empty" && "bg-muted text-muted-foreground"
          )}
          aria-label={`Total ${total == null ? "incomplete" : total} of 10`}
        >
          <span className="text-lg font-bold leading-none">{total == null ? "—" : total}</span>
          <span className="text-[10px] font-medium opacity-70">/10</span>
        </div>
      </div>

      <div className="mt-2 flex gap-1">
        {APGAR_COMPONENT_META.map((meta, i) => {
          const score = value[meta.key];
          const isActive = i === activeIndex;
          const done = score != null;
          return (
            <button
              key={meta.key}
              type="button"
              disabled={disabled}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors",
                isActive && "border-primary bg-primary text-primary-foreground",
                !isActive && done && "border-emerald-500/35 bg-emerald-500/10 text-foreground",
                !isActive && !done && "border-border bg-muted/30 text-muted-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
              aria-label={`${meta.label}: ${score == null ? "not scored" : score}`}
              aria-pressed={isActive}
            >
              <span className="font-serif text-sm font-bold leading-none">{meta.letter}</span>
              <span className="tabular-nums opacity-80">{score == null ? "·" : score}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {active.letter} · {active.label}
          </span>
          <span className="mx-1 opacity-40">·</span>
          {active.short}
        </label>
        <select
          id={selectId}
          disabled={disabled}
          value={activeScore == null ? "" : String(activeScore)}
          onChange={(e) => onSelectChange(e.target.value)}
          style={{ width: `min(100%, ${selectMinCh}ch)` }}
          className={cn(
            "h-8 max-w-full shrink-0 rounded-full border border-border bg-muted/40",
            "py-1 pl-3 pr-8 text-xs text-foreground shadow-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            disabled && "cursor-not-allowed opacity-60"
          )}
          aria-label={`Score for ${active.label}`}
        >
          <option value="" disabled>
            Score…
          </option>
          <option value="0">0 — {active.scores[0]}</option>
          <option value="1">1 — {active.scores[1]}</option>
          <option value="2">2 — {active.scores[2]}</option>
        </select>
      </div>
    </div>
  );
}
