import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  Loader2,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useAssignPodStaff,
  useCreatePod,
  useDeletePod,
  usePods,
  useUnassignPodStaff,
  useUpdatePod,
} from "@/hooks/usePods";
import { useUsers } from "@/hooks/usePlatform";
import { ROLE_LABEL } from "@/lib/staff";
import { StaffAvatar } from "@/components/shared/StaffAvatar";
import { apiErrorMessage } from "@/lib/apiError";
import type { Pod } from "@/types";

type ModalMode = "create" | "edit" | "assign" | null;

const emptyForm = {
  name: "",
  description: "",
  bed_capacity: 12,
  is_active: true,
};

export default function PodsManagePage() {
  const { data: pods, isLoading } = usePods();
  const { data: allStaff } = useUsers("clinical");
  const createPod = useCreatePod();
  const updatePod = useUpdatePod();
  const deletePod = useDeletePod();
  const assignStaff = useAssignPodStaff();
  const unassignStaff = useUnassignPodStaff();

  const [modal, setModal] = useState<ModalMode>(null);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [assignUserId, setAssignUserId] = useState("");
  const [error, setError] = useState("");

  const assignableStaff = useMemo(() => {
    const podName = selectedPod?.name;
    return (allStaff ?? []).filter((u) => {
      const role = u.profile?.role ?? u.role;
      const wards = u.profile?.wards?.length
        ? u.profile.wards
        : u.profile?.ward
          ? [u.profile.ward]
          : [];
      if (podName && wards.includes(podName)) return false;
      if (role === "nurse") return wards.length === 0;
      if (role === "doctor") return wards.length < 3;
      return false;
    });
  }, [allStaff, selectedPod]);

  function openCreate() {
    setForm(emptyForm);
    setSelectedPod(null);
    setError("");
    setModal("create");
  }

  function openEdit(pod: Pod) {
    setSelectedPod(pod);
    setForm({
      name: pod.name,
      description: pod.description,
      bed_capacity: pod.bed_capacity,
      is_active: pod.is_active,
    });
    setError("");
    setModal("edit");
  }

  function openAssign(pod: Pod) {
    setSelectedPod(pod);
    setAssignUserId("");
    setError("");
    setModal("assign");
  }

  function closeModal() {
    setModal(null);
    setSelectedPod(null);
    setError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createPod.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        bed_capacity: Number(form.bed_capacity),
        is_active: form.is_active,
      });
      closeModal();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create pod."));
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPod) return;
    setError("");
    try {
      await updatePod.mutateAsync({
        id: selectedPod.id,
        data: {
          name: form.name.trim(),
          description: form.description.trim(),
          bed_capacity: Number(form.bed_capacity),
          is_active: form.is_active,
        },
      });
      closeModal();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update pod."));
    }
  }

  async function handleDelete(pod: Pod) {
    if (!window.confirm(`Delete "${pod.name}"? This cannot be undone.`)) return;
    try {
      await deletePod.mutateAsync(pod.id);
    } catch (err) {
      alert(apiErrorMessage(err, "Could not delete pod. Remove all staff first."));
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPod || !assignUserId) return;
    setError("");
    try {
      await assignStaff.mutateAsync({
        podId: selectedPod.id,
        userId: Number(assignUserId),
      });
      closeModal();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not assign staff."));
    }
  }

  async function handleUnassign(pod: Pod, userId: number) {
    try {
      await unassignStaff.mutateAsync({ podId: pod.id, userId });
    } catch (err) {
      alert(apiErrorMessage(err, "Could not remove staff from pod."));
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  const list = pods ?? [];

  return (
    <AppLayout>
      <PageHeader
        title="Manage PODs"
        description="Create NICU pods, set capacity, and assign clinical staff"
        action={
          <Button type="button" size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="ml-1">New POD</span>
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No pods configured</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first NICU pod to assign staff.</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create POD
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            list.length === 1
              ? "grid grid-cols-1 gap-4"
              : list.length === 2
                ? "grid grid-cols-1 gap-4 md:grid-cols-2"
                : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {list.map((pod) => (
            <Card
              key={pod.id}
              className={`flex h-full flex-col ${!pod.is_active ? "opacity-75" : ""}`}
            >
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{pod.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {(pod.occupied_beds ?? 0)}/{pod.bed_capacity} beds - {pod.staff_count} staff
                      </p>
                    </div>
                  </div>
                  <Badge variant={pod.is_active ? "default" : "secondary"} className="text-[10px]">
                    {pod.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-4 p-4">
                {pod.description && (
                  <p className="text-sm text-muted-foreground">{pod.description}</p>
                )}

                <div className="flex-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assigned staff
                  </p>
                  {pod.staff.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No staff assigned.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pod.staff.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <StaffAvatar
                              name={member.full_name || member.username}
                              username={member.username}
                              role={member.role}
                              size="xs"
                              fallbackClassName="bg-muted text-muted-foreground"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{member.full_name || member.username}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {ROLE_LABEL[member.role] ?? member.role}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            title="Remove from pod"
                            onClick={() => handleUnassign(pod, member.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => openAssign(pod)}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign staff
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(pod)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(pod)}
                    disabled={pod.staff_count > 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal === "create" && (
        <PodFormModal
          title="Create POD"
          description="Add a new NICU pod for staff assignment."
          form={form}
          setForm={setForm}
          error={error}
          busy={createPod.isPending}
          onClose={closeModal}
          onSubmit={handleCreate}
          submitLabel="Create POD"
        />
      )}

      {modal === "edit" && selectedPod && (
        <PodFormModal
          title="Edit POD"
          description={`Update settings for ${selectedPod.name}.`}
          form={form}
          setForm={setForm}
          error={error}
          busy={updatePod.isPending}
          onClose={closeModal}
          onSubmit={handleEdit}
          submitLabel="Save changes"
        />
      )}

      {modal === "assign" && selectedPod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="pr-8 text-lg font-semibold">Assign staff</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a doctor or nurse to {selectedPod.name}.
            </p>
            <form onSubmit={handleAssign} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="assign_user">Clinical staff</Label>
                <select
                  id="assign_user"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  required
                >
                  <option value="">Select staff…</option>
                  {assignableStaff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.profile?.full_name || u.username} ({ROLE_LABEL[u.profile?.role ?? ""] ?? u.profile?.role})
                      {(u.profile?.wards?.length ?? (u.profile?.ward ? 1 : 0)) > 0
                        ? ` · ${u.profile?.wards?.join(", ") || u.profile?.ward}`
                        : ""}
                    </option>
                  ))}
                </select>
                {assignableStaff.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No staff available: nurses must be free, doctors can join up to 3 pods.
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={assignStaff.isPending || !assignUserId}>
                  {assignStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function PodFormModal({
  title,
  description,
  form,
  setForm,
  error,
  busy,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string;
  description: string;
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="pr-8 text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="pod_name">Pod name</Label>
            <Input
              id="pod_name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="NICU Pod D"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="pod_desc">Description</Label>
            <Input
              id="pod_desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Level III neonatal intensive care"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="pod_capacity">Bed capacity</Label>
            <Input
              id="pod_capacity"
              type="number"
              min={1}
              max={50}
              value={form.bed_capacity}
              onChange={(e) => setForm({ ...form, bed_capacity: Number(e.target.value) })}
              className="mt-1.5"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active pod (available for staff assignment)
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
