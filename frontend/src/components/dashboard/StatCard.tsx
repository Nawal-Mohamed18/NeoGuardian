import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kept for call-site compatibility; all cards use the brand teal palette. */
export type StatCardTone = string;

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Ignored — cards stay on NeoGuardian teal only. */
  tone?: StatCardTone;
  tint?: string;
  iconColor?: string;
  href?: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  deltaTone?: "good" | "bad" | "neutral";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  delta,
  deltaDirection = "up",
  deltaTone = "neutral",
}: StatCardProps) {
  const DeltaIcon = deltaDirection === "up" ? ArrowUpRight : ArrowDownRight;
  const toneClass =
    deltaTone === "good"
      ? "text-teal-700 dark:text-teal-300"
      : deltaTone === "bad"
        ? "text-rose-600 dark:text-rose-300"
        : "text-muted-foreground";

  const content = (
    <div
      className={cn(
        "group relative min-h-[104px] overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-sm",
        "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/40",
        "transform-3d",
        "hover:transform-[perspective(900px)_rotateX(5deg)_rotateY(-4deg)_translateY(-8px)_scale(1.025)]",
        "active:transform-[perspective(900px)_rotateX(0deg)_rotateY(0deg)_translateY(0)_scale(0.99)]",
        href && "cursor-pointer"
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 transition-transform duration-700 ease-out group-hover:translate-x-2 group-hover:-translate-y-1" />
      <div className="pointer-events-none absolute -left-12 top-4 h-24 w-24 rounded-full bg-primary/5 transition-transform duration-700 ease-out group-hover:-translate-x-1 group-hover:translate-y-2" />

      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</p>
        {delta && (
          <span
            className={cn(
              "inline-flex max-w-[50%] items-center justify-end gap-0.5 text-right text-[10px] font-semibold leading-tight",
              toneClass
            )}
          >
            <DeltaIcon className="h-3 w-3 shrink-0" />
            {delta}
          </span>
        )}
      </div>

      <p className="relative mt-2 text-2xl font-bold tracking-tight text-card-foreground sm:text-[1.65rem]">
        {value}
      </p>

      <div className="absolute bottom-3 right-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
