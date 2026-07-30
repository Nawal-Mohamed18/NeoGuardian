import { useQuery } from "@tanstack/react-query";
import { dashboardApi, adminApi, analyticsApi, alertApi } from "@/lib/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardApi.stats(),
  });
}

export function useAdminSystemStats() {
  return useQuery({
    queryKey: ["admin", "system-stats"],
    queryFn: () => adminApi.systemStats(),
    refetchInterval: 30_000,
  });
}

export function useAnalyticsDashboard() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard(),
    refetchInterval: 30_000,
  });
}

export function useRiskTrends(granularity: "day" | "month" = "day") {
  return useQuery({
    queryKey: ["analytics", "risk-trends", granularity],
    queryFn: () => analyticsApi.riskTrends(granularity),
    refetchInterval: 15_000,
  });
}

export function usePodStats() {
  return useQuery({
    queryKey: ["analytics", "pod-stats"],
    queryFn: () => analyticsApi.podStats(),
  });
}

export function useOutcomeTrends() {
  return useQuery({
    queryKey: ["analytics", "outcome-trends"],
    queryFn: () => analyticsApi.outcomeTrends(),
    refetchInterval: 15_000,
  });
}

export function useAlertSummary() {
  return useQuery({
    queryKey: ["alerts", "summary"],
    queryFn: () => alertApi.summary(),
    refetchInterval: 20_000,
  });
}
