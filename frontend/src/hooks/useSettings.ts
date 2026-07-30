import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { authApi, storeUser } from "@/lib/api";
import type { AuthUser } from "@/types/clinical";
import type { UserPreferences } from "@/lib/userPreferences";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: (data: {
      email?: string;
      full_name?: string;
      ward?: string;
      preferences?: Partial<UserPreferences>;
    }) => authApi.updateMe(data),
    onSuccess: async (user: AuthUser) => {
      storeUser(user);
      qc.setQueryData(["auth", "me"], user);
      await refreshUser();
      await qc.invalidateQueries({ queryKey: ["team-chat"] });
      await qc.invalidateQueries({ queryKey: ["clinical-staff"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      authApi.changePassword(data),
  });
}
