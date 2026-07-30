import { cn } from "@/lib/utils";
import { isBlank } from "@/lib/clinicalValidation";

type OptionalClinicalValueProps = {
  value: unknown;
  /** Shown when a value exists (e.g. "mg/dL"). */
  unit?: string;
  className?: string;
  /** Override empty label (default: Not Provided). */
  emptyLabel?: string;
};

/** Never invent healthy defaults in the UI — show Not Provided when blank. */
export function OptionalClinicalValue({
  value,
  unit,
  className,
  emptyLabel = "Not Provided",
}: OptionalClinicalValueProps) {
  if (isBlank(value)) {
    return (
      <span className={cn("italic text-muted-foreground", className)}>{emptyLabel}</span>
    );
  }
  return (
    <span className={className}>
      {String(value)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}
