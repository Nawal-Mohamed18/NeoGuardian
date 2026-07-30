import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUser } from "@/hooks/usePlatform";
import { usePods } from "@/hooks/usePods";
import { apiErrorMessage } from "@/lib/apiError";
import type { AuthUser } from "@/types/clinical";
import type { Role } from "@/lib/roles";

interface StaffEditModalProps {
  user: AuthUser | null;
  open: boolean;
  onClose: () => void;
}

export function StaffEditModal({ user, open, onClose }: StaffEditModalProps) {
  const updateUser = useUpdateUser();
  const { data: pods } = usePods();
  const podOptions = (pods ?? []).filter((p) => p.is_active);
  const [ward, setWard] = useState("");
  const [hospital, setHospital] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && open) {
      setWard(user.profile?.ward ?? "");
      setHospital(user.profile?.hospital || "City Children Hospital");
      setFullName(user.profile?.full_name || "");
      setError("");
    }
  }, [user, open]);

  if (!open || !user) return null;

  const role = (user.profile?.role ?? user.role ?? "nurse") as Role;
  const needsWard = role === "doctor" || role === "nurse";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (needsWard && !ward) {
      setError("Please select a POD for clinical staff.");
      return;
    }
    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: {
          full_name: fullName,
          hospital,
          ward: role === "admin" ? "" : ward,
        },
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update staff."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="pr-8 text-lg font-semibold">Edit — {user.profile?.full_name || user.username}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a NICU pod so this {role} only sees patients in that unit.
        </p>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <Label>Full name</Label>
            <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          {needsWard && (
            <div>
              <Label>Assigned POD *</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                required
              >
                <option value="">Select POD…</option>
                {podOptions.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                    {typeof p.occupied_beds === "number"
                      ? ` — beds ${p.occupied_beds}/${p.bed_capacity}`
                      : ` — capacity ${p.bed_capacity}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>Hospital / department</Label>
            <Input className="mt-1" value={hospital} onChange={(e) => setHospital(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving…" : "Save assignment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
