import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientApi } from "@/lib/api";
import type { Patient } from "@/types";

export function usePatients(params?: { search?: string; status?: string; pod?: number }) {
  return useQuery({
    queryKey: ["patients", params ?? {}],
    queryFn: () => patientApi.list(params),
  });
}

export function usePatient(id: number | undefined) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => patientApi.get(id!),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patientApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

function invalidatePatientQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["patients"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["pods"] });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Patient> }) => patientApi.update(id, data),
    onSuccess: () => invalidatePatientQueries(qc),
  });
}

export function useDischargePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => patientApi.discharge(id),
    onSuccess: () => invalidatePatientQueries(qc),
  });
}

export function useTransferPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pod_id, bed_number }: { id: number; pod_id: number; bed_number?: string }) =>
      patientApi.transfer(id, { pod_id, bed_number }),
    onSuccess: () => invalidatePatientQueries(qc),
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => patientApi.delete(id),
    onSuccess: () => invalidatePatientQueries(qc),
  });
}
