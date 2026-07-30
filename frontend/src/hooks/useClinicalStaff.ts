import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";

export function useClinicalStaff(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["clinical-staff"],
    queryFn: authApi.clinicalStaff,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}
