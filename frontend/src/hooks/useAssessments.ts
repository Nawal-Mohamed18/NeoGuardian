import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentApi } from "@/lib/api";
import type { AssessmentFormData } from "@/types";

export function useAssessments(patientId?: number) {
  return useQuery({
    queryKey: ["assessments", patientId],
    queryFn: () => assessmentApi.list(patientId),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentFormData) => assessmentApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
