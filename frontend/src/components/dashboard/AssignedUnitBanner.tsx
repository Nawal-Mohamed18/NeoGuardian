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
  helper = "Your pod only.",
  emptyHelper = "Ask admin for a POD.",
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

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {hasPods ? `Your assigned unit${pods.length > 1 ? "s" : ""}` : "No POD assigned"}
          </p>
          <div className="mt-1 flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
            <p className="break-words text-base font-bold leading-snug tracking-tight text-card-foreground sm:text-xl">
              {hasPods ? pods.join(" · ") : "Unassigned"}
            </p>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {hasPods ? helper : emptyHelper}
          </p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
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
