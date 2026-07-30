import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertApi } from "@/lib/api";

export function useAlerts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: alertApi.list,
    enabled: options?.enabled ?? true,
    refetchInterval: 20_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertApi.acknowledge,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
