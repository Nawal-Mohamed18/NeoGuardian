import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UnitAction = {
  label: string;
  to: string;
  variant?: "default" | "outline" | "secondary";
  icon?: React.ReactNode;
};

type AssignedUnitBannerProps = {
  pods: string[];
  helper?: string;
  emptyHelper?: string;
  actions?: UnitAction[];
  className?: string;
};

/** Single hero strip: assigned unit + primary actions (brand teal only). */
export function AssignedUnitBanner({
  pods,
  helper = "Patients and alerts include all assigned NICU pods (max 3).",
  emptyHelper = "Ask your administrator to assign you to a NICU pod. Until then, no patient data is shown.",
  actions = [],
  className,
}: AssignedUnitBannerProps) {
  const hasPods = pods.length > 0;

  return (
    <section
      className={cn(
        "group relative overflow-hidden rounded-2xl border px-4 py-4 shadow-sm sm:px-5",
        "transition-[background-image,border-color] duration-500 ease-out",
        hasPods
          ? [
              "border-border bg-card",
              "hover:border-primary/30",
            ]
          : [
              "border-border bg-card",
              "hover:border-primary/20",
            ],
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl transition-all duration-500 ease-out group-hover:-right-2 group-hover:top-auto group-hover:-bottom-10" />
      <div className="pointer-events-none absolute bottom-0 right-16 h-20 w-20 rounded-full bg-primary/5 blur-2xl transition-all duration-500 ease-out group-hover:right-auto group-hover:-left-6 group-hover:-top-8" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {hasPods ? `Your assigned unit${pods.length > 1 ? "s" : ""}` : "No POD assigned"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <p className="truncate text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">
              {hasPods ? pods.join(" · ") : "Unassigned"}
            </p>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {hasPods ? helper : emptyHelper}
          </p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.to + action.label}
                size="sm"
                variant={action.variant ?? "default"}
                asChild
              >
                <Link to={action.to}>
                  {action.icon}
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
