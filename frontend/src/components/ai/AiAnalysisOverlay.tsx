import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Brain, Thermometer, Heart, Droplets, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const AI_ANALYSIS_STEPS = [
  "Loading patient information…",
  "Processing clinical vitals…",
  "Extracting clinical features…",
  "Running AI inference…",
  "Calculating confidence score…",
  "Generating explanation…",
  "Finalizing assessment…",
] as const;

const STEP_MS = 950;
/** Keep overlay visible long enough to feel like a real analysis. */
export const AI_ANALYSIS_MIN_MS = 900;

export type VitalSnapshot = {
  temperature?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  sepsis?: boolean;
  respiratory_distress_syndrome?: boolean;
  birth_asphyxia?: boolean;
};

type AiAnalysisOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  vitals?: VitalSnapshot | null;
  className?: string;
};

type VitalChip = {
  key: string;
  label: string;
  value: string;
  danger: boolean;
  icon: typeof Thermometer;
};

function buildVitalChips(vitals?: VitalSnapshot | null): VitalChip[] {
  if (!vitals) return [];
  const chips: VitalChip[] = [];

  if (vitals.temperature != null && Number.isFinite(Number(vitals.temperature))) {
    const t = Number(vitals.temperature);
    chips.push({
      key: "temp",
      label: "Temperature",
      value: `${t.toFixed(1)}°C`,
      danger: t >= 37.8 || t < 36.0,
      icon: Thermometer,
    });
  }
  if (vitals.heart_rate != null && Number.isFinite(Number(vitals.heart_rate))) {
    const hr = Number(vitals.heart_rate);
    chips.push({
      key: "hr",
      label: "Heart rate",
      value: `${Math.round(hr)} bpm`,
      danger: hr > 180 || hr < 90,
      icon: Heart,
    });
  }
  if (vitals.spo2 != null && Number.isFinite(Number(vitals.spo2))) {
    const s = Number(vitals.spo2);
    chips.push({
      key: "spo2",
      label: "SpO₂",
      value: `${Math.round(s)}%`,
      danger: s < 90,
      icon: Droplets,
    });
  }
  if (vitals.respiratory_rate != null && Number.isFinite(Number(vitals.respiratory_rate))) {
    const rr = Number(vitals.respiratory_rate);
    chips.push({
      key: "rr",
      label: "Resp. rate",
      value: `${Math.round(rr)} /min`,
      danger: rr > 70 || rr < 25,
      icon: Activity,
    });
  }
  if (vitals.sepsis) {
    chips.push({ key: "sepsis", label: "Sepsis", value: "Suspected", danger: true, icon: AlertTriangle });
  }
  if (vitals.respiratory_distress_syndrome) {
    chips.push({ key: "rds", label: "RDS", value: "Present", danger: true, icon: AlertTriangle });
  }
  if (vitals.birth_asphyxia) {
    chips.push({ key: "asphyxia", label: "Asphyxia", value: "Recorded", danger: true, icon: AlertTriangle });
  }
  return chips;
}

export function AiAnalysisOverlay({
  open,
  title = "AI clinical analysis",
  subtitle = "NeoGuardian is reviewing neonatal risk signals",
  vitals,
  className,
}: AiAnalysisOverlayProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(6);
  const chips = useMemo(() => buildVitalChips(vitals), [vitals]);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setProgress(6);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const stepTimer = window.setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, AI_ANALYSIS_STEPS.length - 1));
    }, STEP_MS);

    const progressTimer = window.setInterval(() => {
      setProgress((p) => Math.min(p + 1.15, 96));
    }, 140);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = stepRefs.current[activeStep];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeStep, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-3 sm:p-6",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
            <EcgLine />
          </div>

          <motion.div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="relative flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[1.75rem]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <div className="shrink-0 border-b border-border px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                  <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                  <span className="absolute inset-1 rounded-full border-2 border-primary/40 animate-[spin_8s_linear_infinite]" />
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 sm:h-12 sm:w-12">
                    <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
                  <BreathingDots className="mt-3" />
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground sm:text-sm">
                  <span>Analysis progress</span>
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: "6%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.25 }}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
              {chips.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Vitals in process
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {chips.map((chip, i) => {
                      const Icon = chip.icon;
                      return (
                        <motion.div
                          key={chip.key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 * i }}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl border px-3.5 py-2.5",
                            chip.danger
                              ? "border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-100"
                              : "border-border bg-muted/40 text-card-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              chip.danger
                                ? "bg-red-500/20 text-red-700 dark:text-red-300"
                                : "bg-primary/15 text-primary"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {chip.label}
                            </p>
                            <p className="truncate text-sm font-semibold">{chip.value}</p>
                          </div>
                          {chip.danger && (
                            <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Alert
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {AI_ANALYSIS_STEPS.map((label, i) => {
                  const done = i < activeStep;
                  const current = i === activeStep;
                  return (
                    <motion.li
                      key={label}
                      ref={(node) => {
                        stepRefs.current[i] = node;
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm transition-colors",
                        done && "border-primary/30 bg-primary/10 text-card-foreground",
                        current && "border-primary/50 bg-primary/15 text-card-foreground shadow-sm",
                        !done && !current && "border-transparent bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          done && "bg-primary text-primary-foreground",
                          current && "bg-primary text-primary-foreground",
                          !done && !current && "bg-muted text-muted-foreground"
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className={cn(current && "font-medium")}>{label}</span>
                      {current && <PulseDot className="ml-auto" />}
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            <p className="shrink-0 border-t border-border px-5 py-3 text-center text-[11px] leading-relaxed text-muted-foreground sm:px-8">
              Clinical decision support only — final care decisions remain with the attending team.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BreathingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

function EcgLine() {
  return (
    <svg
      className="absolute bottom-16 left-0 w-full opacity-30"
      viewBox="0 0 800 60"
      fill="none"
      aria-hidden
    >
      <motion.path
        d="M0 30 H120 L140 30 L155 8 L175 52 L195 30 H320 L340 30 L355 12 L375 48 L395 30 H520 L540 30 L555 10 L575 50 L595 30 H800"
        stroke="url(#ecgGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: [0, 1], opacity: [0.25, 0.7, 0.25] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <defs>
        <linearGradient id="ecgGrad" x1="0" y1="0" x2="800" y2="0">
          <stop stopColor="#2dd4bf" stopOpacity="0" />
          <stop offset="0.4" stopColor="#14b8a6" />
          <stop offset="0.7" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Run an async task while showing the overlay for at least AI_ANALYSIS_MIN_MS. */
export async function withAiAnalysisExperience<T>(task: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await task();
  const elapsed = Date.now() - started;
  if (elapsed < AI_ANALYSIS_MIN_MS) {
    await new Promise((r) => setTimeout(r, AI_ANALYSIS_MIN_MS - elapsed));
  }
  return result;
}
