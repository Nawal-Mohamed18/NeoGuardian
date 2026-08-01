import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Stethoscope, Users, UserCog } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { StaffDetailModal } from "@/components/staff/StaffDetailModal";
import { StaffEditModal } from "@/components/staff/StaffEditModal";
import { StaffRegisterModal } from "@/components/staff/StaffRegisterModal";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUsers, useUpdateUser, useDeleteUser } from "@/hooks/usePlatform";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABEL,
  formatLastLogin,
  accountStatus,
} from "@/lib/staff";
import { StaffAvatar } from "@/components/shared/StaffAvatar";
import type { AuthUser } from "@/types/clinical";
import { apiErrorMessage } from "@/lib/apiError";

export default function StaffManagePage() {
  const { data, isLoading } = useUsers("all");
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [showRegister, setShowRegister] = useState(false);
  const [viewUser, setViewUser] = useState<AuthUser | null>(null);
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const users = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      const aTime = a.date_joined ? new Date(a.date_joined).getTime() : a.id;
      const bTime = b.date_joined ? new Date(b.date_joined).getTime() : b.id;
      return aTime - bTime;
    });
  }, [data]);

  const doctorCount = users.filter((u) => (u.profile?.role ?? u.role) === "doctor" && u.is_active !== false).length;
  const nurseCount = users.filter((u) => (u.profile?.role ?? u.role) === "nurse" && u.is_active !== false).length;
  const adminCount = users.filter((u) => (u.profile?.role ?? u.role) === "admin" && u.is_active !== false).length;

  async function handleDeactivate(user: AuthUser) {
    const active = user.is_active !== false;
    const name = user.profile?.full_name || user.username;
    if (active && !window.confirm(`Deactivate ${name}? They will not be able to sign in.`)) return;
    setBusyId(user.id);
    try {
      await updateUser.mutateAsync({ id: user.id, data: { is_active: !active } });
    } catch (err) {
      alert(apiErrorMessage(err, "Could not update account status."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: AuthUser) {
    const name = user.profile?.full_name || user.username;
    if (!window.confirm(`Permanently delete ${name}? Register them again if needed.`)) return;
    setBusyId(user.id);
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (err) {
      alert(apiErrorMessage(err, "Could not delete this account."));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Clinical Staff Directory"
        description="Doctors, nurses, and operators · Deactivate blocks login · Delete removes permanently"
        action={
          <Button type="button" size="sm" onClick={() => setShowRegister(true)}>
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active Doctors" value={doctorCount} icon={Stethoscope} tone="violet" delta="Clinical leads" />
        <StatCard label="Active Nurses" value={nurseCount} icon={Users} tone="emerald" delta="Primary caregivers" />
        <StatCard label="Active Admins" value={adminCount} icon={UserCog} tone="sky" delta="System operators" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">All clinical staff</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">POD</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No staff yet.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setShowRegister(true)}
                    >
                      Add the first account
                    </button>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = user.profile?.role ?? user.role ?? "nurse";
                  const active = user.is_active !== false;
                  const canManage = role !== "admin";
                  const needsWard = (role === "doctor" || role === "nurse") && !user.profile?.ward && active;
                  const status = accountStatus(user);
                  const fullName = user.profile?.full_name || user.username;
                  return (
                    <tr key={user.id} className="border-b border-border/70 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StaffAvatar
                            name={fullName}
                            username={user.username}
                            role={role}
                            avatarData={user.profile?.preferences?.avatar_data}
                            size="sm"
                            fallbackClassName={ROLE_BADGE_CLASS[role] ?? ""}
                          />
                          <div>
                            <p className="font-medium text-foreground">{fullName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_BADGE_CLASS[role] ?? ""}`}>
                          {ROLE_LABEL[role] ?? role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.profile?.ward || (
                          <span className={needsWard ? "font-medium text-amber-700" : "text-muted-foreground"}>
                            {needsWard ? "Assign POD" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatLastLogin(user.last_login)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View details"
                            className="rounded-md p-2 text-teal-700 hover:bg-teal-50"
                            onClick={() => setViewUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                title="Edit POD assignment"
                                className="rounded-md p-2 text-teal-700 hover:bg-teal-50"
                                onClick={() => setEditUser(user)}
                                disabled={busyId === user.id}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busyId === user.id}
                                onClick={() => handleDeactivate(user)}
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                                  active
                                    ? "border-red-200 text-red-700 hover:bg-red-50"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                disabled={busyId === user.id}
                                onClick={() => handleDelete(user)}
                                className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StaffRegisterModal open={showRegister} onClose={() => setShowRegister(false)} />
      <StaffDetailModal user={viewUser} open={!!viewUser} onClose={() => setViewUser(null)} />
      <StaffEditModal user={editUser} open={!!editUser} onClose={() => setEditUser(null)} />
    </AppLayout>
  );
}
