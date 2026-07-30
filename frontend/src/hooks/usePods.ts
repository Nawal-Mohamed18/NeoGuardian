import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { podApi } from "@/lib/api";
import type { Pod } from "@/types";

export function usePods() {
  return useQuery({
    queryKey: ["pods"],
    queryFn: () => podApi.list(),
    // Occupancy changes on every admit/discharge — keep this fresh for bed checks.
    staleTime: 5_000,
    refetchOnMount: "always",
  });
}

export function useCreatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: podApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pods"] }),
  });
}

export function useUpdatePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pod> }) => podApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pods"] });
      qc.invalidateQueries({ queryKey: ["auth", "users"] });
    },
  });
}

export function useDeletePod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => podApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pods"] }),
  });
}

export function useAssignPodStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ podId, userId }: { podId: number; userId: number }) =>
      podApi.assignStaff(podId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pods"] });
      qc.invalidateQueries({ queryKey: ["auth", "users"] });
    },
  });
}

export function useUnassignPodStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ podId, userId }: { podId: number; userId: number }) =>
      podApi.unassignStaff(podId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pods"] });
      qc.invalidateQueries({ queryKey: ["auth", "users"] });
    },
  });
}
