import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { resolveModelInformation } from "@/lib/modelInfo";
import { cn } from "@/lib/utils";

type ModelInformationCardProps = {
  className?: string;
  defaultOpen?: boolean;
  /** Optional runtime model id from an assessment (display only). */
  runtimeModelUsed?: string | null;
};

export function ModelInformationCard({
  className,
  defaultOpen = false,
  runtimeModelUsed,
}: ModelInformationCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const info = resolveModelInformation(runtimeModelUsed);

  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold text-foreground">{info.title}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
          <Row label="Model" value={info.modelName} />
          <Row label="Version" value={runtimeModelUsed || info.version} />
          <Row label="Purpose" value={info.purpose} />
          <Row label="Training" value={info.training} />
          <Row label="Status" value={info.status} />
          <Row label="Clinical use" value={info.clinicalUse} />
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{info.judgmentNote}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
