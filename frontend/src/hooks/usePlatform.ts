import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi, authApi } from "@/lib/api";
import type { Role } from "@/lib/roles";

export type StaffGroup = "clinical" | "admin" | "all";

export function useSystemHealth() {
  return useQuery({ queryKey: ["system", "health"], queryFn: dashboardApi.health });
}

export function useUsers(group: StaffGroup = "all") {
  return useQuery({
    queryKey: ["users", group],
    queryFn: () => authApi.users(group),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      username: string;
      email: string;
      password: string;
      full_name: string;
      hospital?: string;
      role: Role;
      ward?: string;
    }) => authApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        role?: Role;
        is_active?: boolean;
        full_name?: string;
        hospital?: string;
        ward?: string;
        password?: string;
      };
    }) => authApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => authApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
