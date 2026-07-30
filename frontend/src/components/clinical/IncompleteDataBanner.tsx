import { AlertTriangle } from "lucide-react";
import {
  INCOMPLETE_DATA_MESSAGE,
  listMissingClinicalFields,
  type ClinicalSnapshot,
} from "@/lib/missingClinicalData";
import { cn } from "@/lib/utils";

type IncompleteDataBannerProps = {
  snapshot: ClinicalSnapshot;
  className?: string;
};

/** Warns clinicians when prediction inputs are incomplete — does not block prediction. */
export function IncompleteDataBanner({ snapshot, className }: IncompleteDataBannerProps) {
  const missing = listMissingClinicalFields(snapshot);
  if (missing.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50",
        className
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{INCOMPLETE_DATA_MESSAGE}</p>
        <p className="text-xs opacity-90">
          Not provided: {missing.map((m) => m.label).join(", ")}. Blood glucose is required for
          the risk model and is never filled with a default. Complete required vitals before
          submit.
        </p>
      </div>
    </div>
  );
}
