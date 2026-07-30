import { useEffect, useState } from "react";
import { KeyRound, Mail, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUser } from "@/hooks/usePlatform";
import { apiErrorMessage } from "@/lib/apiError";
import { ROLE_TITLE, formatLastLogin, accountStatus } from "@/lib/staff";
import { StaffAvatar } from "@/components/shared/StaffAvatar";
import type { AuthUser } from "@/types/clinical";

interface StaffDetailModalProps {
  user: AuthUser | null;
  open: boolean;
  onClose: () => void;
}

export function StaffDetailModal({ user, open, onClose }: StaffDetailModalProps) {
  const updateUser = useUpdateUser();
  const [newPassword, setNewPassword] = useState("");
  const [revealedPass, setRevealedPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setRevealedPass("");
      setShowPass(false);
      setError("");
    }
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
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

  if (!open || !user) return null;

  const role = user.profile?.role ?? user.role ?? "nurse";
  const fullName = user.profile?.full_name || user.username;
  const status = accountStatus(user);
  const canResetPassword = role !== "admin";

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await updateUser.mutateAsync({ id: user.id, data: { password: newPassword } });
      setRevealedPass(newPassword);
      setShowPass(true);
      setNewPassword("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update password."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-muted hover:rotate-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <header className="bg-linear-to-br from-teal-50 to-cyan-50 px-5 py-6">
          <div className="flex items-center gap-3">
            <StaffAvatar
              name={fullName}
              username={user.username}
              role={role}
              avatarData={user.profile?.preferences?.avatar_data}
              size="lg"
              className="border-teal-200"
              fallbackClassName="bg-teal-600 text-white"
            />
            <div>
              <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
              <p className="text-sm text-muted-foreground">
                {ROLE_TITLE[role] ?? role}
                {user.profile?.wards?.length
                  ? ` · ${user.profile.wards.join(", ")}`
                  : user.profile?.ward
                    ? ` · ${user.profile.ward}`
                    : " · No POD assigned"}
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <ul className="space-y-3 text-sm">
            <InfoRow icon={<UserRound className="h-4 w-4" />} label="Hospital" value={user.profile?.hospital || "City Children Hospital"} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <InfoRow icon={<UserRound className="h-4 w-4" />} label="Username" value={user.username} />
            <InfoRow
              icon={<KeyRound className="h-4 w-4" />}
              label="Temporary password"
              value={
                revealedPass
                  ? (
                    <span className="inline-flex items-center gap-2">
                      {showPass ? revealedPass : "••••••••"}
                      <button type="button" className="text-xs font-semibold text-primary" onClick={() => setShowPass((s) => !s)}>
                        {showPass ? "Hide" : "Show"}
                      </button>
                    </span>
                  )
                  : "Set below (encrypted in database)"
              }
            />
            <InfoRow
              icon={<UserRound className="h-4 w-4" />}
              label="Account status"
              value={<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>}
            />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Last login" value={formatLastLogin(user.last_login)} />
          </ul>

          <p className="text-xs text-muted-foreground">Staff ID: {user.id}</p>

          {canResetPassword && (
            <form onSubmit={handleReset} className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <Label>Set new temporary password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" size="sm" disabled={updateUser.isPending}>
                {updateUser.isPending ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium text-foreground">{value}</div>
      </div>
    </li>
  );
}
