import type { AuthUser } from "@/types/clinical";
import type { Patient } from "@/types";

/** POD names assigned to the signed-in clinician (empty for admin / unassigned). */
export function assignedPodsFromUser(user: AuthUser | null | undefined): string[] {
  const fromList = user?.profile?.wards?.map((w) => w.trim()).filter(Boolean) ?? [];
  if (fromList.length) return fromList;
  const single = user?.profile?.ward?.trim();
  return single ? [single] : [];
}

function normPod(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

/** True when patient is in one of the clinician's assigned PODs. */
export function patientInAssignedPods(
  patient: Pick<Patient, "pod_name" | "status">,
  assignedPods: string[],
  activeOnly = true
): boolean {
  if (activeOnly && patient.status && patient.status !== "active") return false;
  if (!assignedPods.length) return false;
  const pod = normPod(patient.pod_name);
  if (!pod) return false;
  return assignedPods.some((w) => normPod(w) === pod);
}

/**
 * Clinical staff: only assigned POD(s).
 * Admin: all patients (optionally active-only).
 */
export function scopePatientsForRole(
  patients: Patient[],
  opts: {
    role: string | undefined;
    assignedPods: string[];
    activeOnly?: boolean;
  }
): Patient[] {
  const list = patients ?? [];
  const activeOnly = opts.activeOnly !== false;
  if (opts.role === "admin") {
    return activeOnly ? list.filter((p) => !p.status || p.status === "active") : list;
  }
  return list.filter((p) => patientInAssignedPods(p, opts.assignedPods, activeOnly));
}
