import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateUser } from "@/hooks/usePlatform";
import { usePods } from "@/hooks/usePods";
import { ROLE_LIST, type Role } from "@/lib/roles";
import { apiErrorMessage } from "@/lib/apiError";

interface StaffRegisterModalProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = {
  username: "",
  email: "",
  password: "",
  full_name: "",
  hospital: "City Children Hospital",
  role: "nurse" as Role,
  ward: "",
};

export function StaffRegisterModal({ open, onClose }: StaffRegisterModalProps) {
  const createUser = useCreateUser();
  const { data: pods } = usePods();
  const podOptions = (pods ?? []).filter((p) => p.is_active);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!form.username.trim() || !/^[a-zA-Z0-9._-]+$/.test(form.username.trim())) {
      setError("Username is required and may only contain letters, numbers, dots, underscores, and hyphens.");
      return;
    }
    if ((form.role === "doctor" || form.role === "nurse") && !form.ward) {
      setError("Select a POD assignment for clinical staff.");
      return;
    }
    try {
      await createUser.mutateAsync({
        ...form,
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        ward: form.role === "admin" ? "" : form.ward,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create this account."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Register New Staff Member</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Create a login for a doctor, nurse, or admin.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
            <div>
              <Label>Full name *</Label>
              <Input
                className="mt-1"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Username *</Label>
                <Input
                  className="mt-1"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email address *</Label>
                <Input
                  type="email"
                  className="mt-1"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Temporary password *</Label>
              <Input
                type="password"
                className="mt-1"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Role *</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role, ward: "" })}
              >
                {ROLE_LIST.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {(form.role === "nurse" || form.role === "doctor") && (
              <div>
                <Label>
                  POD assignment {form.role === "doctor" ? "(required for doctors to see patients)" : "*"}
                </Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.ward}
                  onChange={(e) => setForm({ ...form, ward: e.target.value })}
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button type="submit" className="flex-1" disabled={createUser.isPending}>
              {createUser.isPending ? "Registering…" : "Register User"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
