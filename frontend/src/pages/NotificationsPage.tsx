import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAlerts, useAcknowledgeAlert } from "@/hooks/useAlerts";
import { useAuth } from "@/context/AuthContext";
import { cn, formatDateTime } from "@/lib/utils";
import type { Alert } from "@/types";

type RiskBucket = "high" | "moderate" | "low";
type StatusFilter = "all" | "active" | "resolved";
type RiskFilter = "all" | RiskBucket;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "All risk" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
];

function alertBucket(alert: Alert): RiskBucket {
  if (alert.severity === "critical" || /high risk/i.test(alert.title)) return "high";
  if (alert.severity === "warning" || /moderate risk/i.test(alert.title)) return "moderate";
  return "low";
}

function matchesRisk(alert: Alert, risk: RiskFilter): boolean {
  if (risk === "all") return true;
  return alertBucket(alert) === risk;
}

const BUCKET_META: Record<
  RiskBucket,
  { label: string; badge: string; card: string }
> = {
  high: {
    label: "High",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-200 dark:border-red-400/40",
    card: "border-red-200/80 bg-card dark:border-red-500/30 dark:bg-red-950/25",
  },
  moderate: {
    label: "Moderate",
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40",
    card: "border-amber-200/80 bg-card dark:border-amber-500/30 dark:bg-amber-950/20",
  },
  low: {
    label: "Low",
    badge:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40",
    card: "border-emerald-200/80 bg-card dark:border-emerald-500/30 dark:bg-emerald-950/20",
  },
};

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  counts,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  counts: Record<T, number>;
  onChange: (value: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-w-0 w-full sm:min-w-36 justify-between gap-2 border-border bg-card font-medium"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="truncate text-foreground">{selected?.label}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground">
              {counts[value]}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              {value === option.value ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <span className="inline-block w-3.5" />
              )}
              {option.label}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {counts[option.value]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function NotificationsPage() {
  const { can } = useAuth();
  const { data: alerts, isLoading, isError } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const canAck = can("alert.acknowledge");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  const unack = useMemo(() => alerts?.filter((a) => !a.acknowledged) ?? [], [alerts]);
  const acked = useMemo(() => alerts?.filter((a) => a.acknowledged) ?? [], [alerts]);

  const statusCounts = useMemo(
    () =>
      ({
        all: alerts?.length ?? 0,
        active: unack.length,
        resolved: acked.length,
      }) satisfies Record<StatusFilter, number>,
    [alerts, unack.length, acked.length]
  );

  const riskCounts = useMemo(() => {
    const pool =
      statusFilter === "active"
        ? unack
        : statusFilter === "resolved"
          ? acked
          : (alerts ?? []);
    return {
      all: pool.length,
      high: pool.filter((a) => alertBucket(a) === "high").length,
      moderate: pool.filter((a) => alertBucket(a) === "moderate").length,
      low: pool.filter((a) => alertBucket(a) === "low").length,
    } satisfies Record<RiskFilter, number>;
  }, [alerts, unack, acked, statusFilter]);

  const filteredActive = useMemo(
    () =>
      statusFilter === "resolved"
        ? []
        : unack.filter((a) => matchesRisk(a, riskFilter)),
    [unack, statusFilter, riskFilter]
  );

  const filteredResolved = useMemo(
    () =>
      statusFilter === "active"
        ? []
        : acked.filter((a) => matchesRisk(a, riskFilter)),
    [acked, statusFilter, riskFilter]
  );

  const high = useMemo(
    () => filteredActive.filter((a) => alertBucket(a) === "high"),
    [filteredActive]
  );
  const moderate = useMemo(
    () => filteredActive.filter((a) => alertBucket(a) === "moderate"),
    [filteredActive]
  );
  const low = useMemo(
    () => filteredActive.filter((a) => alertBucket(a) === "low"),
    [filteredActive]
  );

  const showActiveBlock = statusFilter !== "resolved";
  const showResolvedBlock = statusFilter !== "active";
  const showHigh = riskFilter === "all" || riskFilter === "high";
  const showModerate = riskFilter === "all" || riskFilter === "moderate";
  const showLow = riskFilter === "all" || riskFilter === "low";

  const hasVisibleContent =
    high.length > 0 ||
    moderate.length > 0 ||
    low.length > 0 ||
    filteredResolved.length > 0 ||
    (showActiveBlock && riskFilter === "low" && low.length === 0);

  if (isLoading)
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  if (isError)
    return (
      <AppLayout>
        <p className="text-destructive">Failed to load notifications.</p>
      </AppLayout>
    );

  return (
    <AppLayout alertCount={unack.length}>
      <PageHeader
        title="Clinical Alerts"
        action={
          <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:max-w-none sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              counts={statusCounts}
              onChange={setStatusFilter}
            />
            <FilterDropdown
              label="Risk"
              value={riskFilter}
              options={RISK_OPTIONS}
              counts={riskCounts}
              onChange={setRiskFilter}
            />
          </div>
        }
      />

      {showActiveBlock && (
        <div className="space-y-3">
          {showHigh &&
            high.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                bucket="high"
                canAck={canAck}
                onResolve={(id) => acknowledge.mutate(id)}
                resolving={acknowledge.isPending}
              />
            ))}
          {showModerate &&
            moderate.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                bucket="moderate"
                canAck={canAck}
                onResolve={(id) => acknowledge.mutate(id)}
                resolving={acknowledge.isPending}
              />
            ))}
          {showLow &&
            (low.length > 0
              ? low.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    bucket="low"
                    canAck={canAck}
                    onResolve={(id) => acknowledge.mutate(id)}
                    resolving={acknowledge.isPending}
                  />
                ))
              : riskFilter === "low" && (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    No low-risk notices right now. Stable (Low) assessments appear here when
                    recorded.
                  </p>
                ))}
        </div>
      )}

      {showResolvedBlock && filteredResolved.length > 0 && (
        <section className={cn(showActiveBlock && filteredActive.length > 0 && "mt-8")}>
          <div className="space-y-2">
            {filteredResolved.map((alert) => {
              const bucket = alertBucket(alert);
              const meta = BUCKET_META[bucket];
              return (
                <Card key={alert.id} className="opacity-70">
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          Resolved
                        </Badge>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            meta.badge
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {alert.patient_code} · {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to={`/newborns/${alert.patient}`}>View profile</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!alerts?.length && (
        <EmptyState
          title="No notifications"
          description="Alerts appear for High, Moderate, and Low risk assessments so the unit board stays complete."
        />
      )}

      {!!alerts?.length && !hasVisibleContent && (
        <EmptyState
          title="No alerts match these filters"
          description="Try another Status and Risk combination in the dropdowns."
        />
      )}
    </AppLayout>
  );
}

function AlertCard({
  alert,
  bucket,
  canAck,
  onResolve,
  resolving,
}: {
  alert: Alert;
  bucket: RiskBucket;
  canAck: boolean;
  onResolve: (id: number) => void;
  resolving: boolean;
}) {
  const meta = BUCKET_META[bucket];
  return (
    <Card className={cn("border", meta.card)}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{alert.title}</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                meta.badge
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {alert.patient_code} · {formatDateTime(alert.created_at)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/newborns/${alert.patient}`}>View profile</Link>
            </Button>
            {canAck && (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/ai-center/assess?patient=${alert.patient}`}>Re-assess</Link>
              </Button>
            )}
          </div>
        </div>
        {canAck && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-border bg-background text-foreground hover:bg-muted"
            onClick={() => onResolve(alert.id)}
            disabled={resolving}
          >
            Mark as resolved
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
