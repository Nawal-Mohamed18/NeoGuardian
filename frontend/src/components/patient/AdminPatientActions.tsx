import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, LogOut, ArrowRightLeft, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useUpdatePatient,
  useDischargePatient,
  useTransferPatient,
  useDeletePatient,
} from "@/hooks/usePatients";
import { usePods } from "@/hooks/usePods";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

type Modal = "edit" | "discharge" | "transfer" | "delete" | null;

function IconActionButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-8 w-8 px-0",
          destructive && "border-destructive/40 text-destructive hover:bg-destructive/10"
        )}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </Button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2",
          "whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background",
          "opacity-0 shadow-md transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function normalizeBed(value: string) {
  return value.trim().toUpperCase();
}

function findOccupiedConflict(
  labels: { bed: string; patient_code: string }[] | undefined,
  bedNumber: string,
  excludePatientCode?: string
) {
  const bed = normalizeBed(bedNumber);
  if (!bed || !labels?.length) return null;
  return (
    labels.find(
      (row) =>
        normalizeBed(row.bed) === bed &&
        (!excludePatientCode || row.patient_code !== excludePatientCode)
    ) ?? null
  );
}

export function AdminPatientActions({
  patient,
  compact = false,
}: {
  patient: Patient;
  /** Icon-only toolbar for dense chart headers. */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { data: pods } = usePods();
  const updatePatient = useUpdatePatient();
  const dischargePatient = useDischargePatient();
  const transferPatient = useTransferPatient();
  const deletePatient = useDeletePatient();

  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [transferPodId, setTransferPodId] = useState("");
  const [transferBed, setTransferBed] = useState("");

  const isActive = (patient.status ?? "active") === "active";
  const podOptions = (pods ?? []).filter((p) => p.is_active && p.id !== patient.pod);
  const currentPod = (pods ?? []).find((p) => p.id === patient.pod);
  const destPod = (pods ?? []).find((p) => String(p.id) === transferPodId);

  useEffect(() => {
    if (modal === "edit") {
      setDisplayName(patient.display_name ?? "");
      setBedNumber(patient.bed_number ?? "");
      setError("");
    }
    if (modal === "transfer") {
      setTransferPodId("");
      setTransferBed(patient.bed_number ?? "");
      setError("");
    }
    if (modal === "discharge" || modal === "delete") setError("");
  }, [modal, patient]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const conflict = findOccupiedConflict(
      currentPod?.occupied_bed_labels,
      bedNumber,
      patient.patient_code
    );
    if (conflict) {
      setError(
        `Bed '${normalizeBed(bedNumber)}' is already assigned to ${conflict.patient_code}. Choose a different bed.`
      );
      return;
    }
    try {
      await updatePatient.mutateAsync({
        id: patient.id,
        data: {
          display_name: displayName.trim(),
          bed_number: bedNumber.trim(),
        },
      });
      setModal(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update patient."));
    }
  }

  async function handleDischarge() {
    setError("");
    try {
      await dischargePatient.mutateAsync(patient.id);
      setModal(null);
      navigate("/newborns?status=discharged", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not discharge patient."));
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!transferPodId) {
      setError("Select a destination POD.");
      return;
    }
    if (destPod) {
      const capacity = destPod.bed_capacity ?? 0;
      const used = destPod.occupied_beds ?? destPod.occupied_bed_labels?.length ?? 0;
      if (capacity > 0 && used >= capacity) {
        setError(`${destPod.name} is at capacity. Free a bed before transferring.`);
        return;
      }
      if (transferBed.trim()) {
        const conflict = findOccupiedConflict(destPod.occupied_bed_labels, transferBed);
        if (conflict) {
          setError(
            `Bed '${normalizeBed(transferBed)}' is already assigned to ${conflict.patient_code} in ${destPod.name}.`
          );
          return;
        }
      }
    }
    try {
      await transferPatient.mutateAsync({
        id: patient.id,
        pod_id: Number(transferPodId),
        bed_number: transferBed.trim() || undefined,
      });
      setModal(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not transfer patient."));
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await deletePatient.mutateAsync(patient.id);
      setModal(null);
      navigate("/newborns", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not delete patient."));
    }
  }

  const busy =
    updatePatient.isPending ||
    dischargePatient.isPending ||
    transferPatient.isPending ||
    deletePatient.isPending;

  return (
    <>
      <div className={cn("flex items-center justify-end", compact ? "gap-1" : "flex-wrap gap-2")}>
        {compact ? (
          <>
            <IconActionButton label="Edit" onClick={() => setModal("edit")} disabled={busy}>
              <Pencil className="h-3.5 w-3.5" />
            </IconActionButton>
            {isActive && (
              <>
                <IconActionButton
                  label="Transfer"
                  onClick={() => setModal("transfer")}
                  disabled={busy}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </IconActionButton>
                <IconActionButton
                  label="Discharge"
                  onClick={() => setModal("discharge")}
                  disabled={busy}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </IconActionButton>
              </>
            )}
            <IconActionButton
              label="Delete"
              onClick={() => setModal("delete")}
              disabled={busy}
              destructive
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconActionButton>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => setModal("edit")} disabled={busy}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            {isActive && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal("transfer")}
                  disabled={busy}
                >
                  <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                  Transfer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal("discharge")}
                  disabled={busy}
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Discharge
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setModal("delete")}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !busy && setModal(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <button
              type="button"
              onClick={() => !busy && setModal(null)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
              aria-label="Close"
              disabled={busy}
            >
              <X className="h-4 w-4" />
            </button>

            {modal === "edit" && (
              <form onSubmit={handleEdit} className="space-y-4">
                <h3 className="pr-8 text-lg font-semibold">Edit hospital info</h3>
                <p className="text-sm text-muted-foreground">
                  {patient.patient_code}
                  {patient.pod_name ? ` · ${patient.pod_name}` : ""} — clinical vitals stay unchanged.
                </p>
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="display_name">Display name</Label>
                    <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="bed">Bed number</Label>
                    <Input id="bed" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder="e.g. A-12" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To move units, use Transfer — not this form.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModal(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy}>
                    Save
                  </Button>
                </div>
              </form>
            )}

            {modal === "discharge" && (
              <div className="space-y-4">
                <h3 className="pr-8 text-lg font-semibold">Discharge patient</h3>
                <p className="text-sm text-muted-foreground">
                  {patient.patient_code} will leave the NICU. Their bed/POD will be freed, and doctors/nurses will no
                  longer see them. You can still find them under Discharged.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModal(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={handleDischarge} disabled={busy}>
                    Confirm discharge
                  </Button>
                </div>
              </div>
            )}

            {modal === "transfer" && (
              <form onSubmit={handleTransfer} className="space-y-4">
                <h3 className="pr-8 text-lg font-semibold">Transfer patient</h3>
                <p className="text-sm text-muted-foreground">
                  Move {patient.patient_code} from {patient.pod_name || "current POD"} to another unit. They stay active.
                </p>
                <div>
                  <Label htmlFor="dest_pod">Destination POD</Label>
                  <select
                    id="dest_pod"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={transferPodId}
                    onChange={(e) => setTransferPodId(e.target.value)}
                    required
                  >
                    <option value="">Select POD…</option>
                    {podOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.occupied_beds != null && p.bed_capacity != null
                          ? ` (${p.occupied_beds}/${p.bed_capacity})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="tbed">Bed number (optional)</Label>
                  <Input id="tbed" value={transferBed} onChange={(e) => setTransferBed(e.target.value)} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModal(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || podOptions.length === 0}>
                    Transfer
                  </Button>
                </div>
              </form>
            )}

            {modal === "delete" && (
              <div className="space-y-4">
                <h3 className="pr-8 text-lg font-semibold text-destructive">Delete patient</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently remove {patient.patient_code} and related records. This cannot be undone — the patient
                  will be gone for everyone, including admin.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModal(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                    Delete forever
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
