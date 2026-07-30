import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Moon,
  Shield,
  Sun,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { SettingsRow, SettingsToggle } from "@/components/settings/SettingsControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useChangePassword, useCurrentUser, useUpdateProfile } from "@/hooks/useSettings";
import { apiErrorMessage } from "@/lib/apiError";
import {
  CAPABILITY_DETAILS,
  MODULE_LABELS,
  sectionsForRole,
} from "@/lib/settingsConfig";
import { ROLES, type Capability, type Role } from "@/lib/roles";
import {
  DEFAULT_USER_PREFERENCES,
  type SettingsSectionId,
  type UserPreferences,
} from "@/lib/userPreferences";
import { resizeImageToDataUrl, resolveStaffAvatar, AVATAR_CLEARED } from "@/lib/avatarImage";

const SECTION_ICONS: Record<SettingsSectionId, typeof User> = {
  profile: User,
  appearance: Sun,
  notifications: Bell,
  security: KeyRound,
  workspace: LayoutDashboard,
  access: Shield,
};

function formatLastLogin(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function SettingsPage() {
  const { role, roleConfig, signOut, displayName } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: user, isLoading } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const sections = useMemo(() => sectionsForRole(role), [role]);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.profile?.full_name ?? "");
    setEmail(user.email ?? "");
    setPrefs({ ...DEFAULT_USER_PREFERENCES, ...(user.profile?.preferences ?? {}) });
  }, [user]);

  const isClinical = role === "doctor" || role === "nurse";
  const activeMeta = sections.find((s) => s.id === activeSection) ?? sections[0];

  const saveProfile = async () => {
    setSaveMessage(null);
    await updateProfile.mutateAsync({
      full_name: fullName.trim(),
      email: email.trim(),
      preferences: prefs,
    });
    setSaveMessage("Settings saved.");
  };

  const assignedPodsDisplay = (() => {
    const fromList = user?.profile?.wards?.map((w) => w.trim()).filter(Boolean) ?? [];
    if (fromList.length) return fromList.join(" · ");
    return (user?.profile?.ward || "").trim() || "Not assigned";
  })();

  const saveAvatar = async (dataUrl: string) => {
    const next = { ...prefs, avatar_data: dataUrl };
    setPrefs(next);
    setSaveMessage(null);
    try {
      await updateProfile.mutateAsync({ preferences: { avatar_data: dataUrl } });
      setSaveMessage(dataUrl ? "Photo updated." : "Photo removed.");
    } catch {
      setSaveMessage(null);
    }
  };

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const submitPassword = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setPasswordMessage(null);
    if (!currentPassword.trim()) {
      setPasswordMessage("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMessage("New password must be different from your current password.");
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        "Password updated successfully. Use this new password the next time you sign in."
      );
    } catch (err) {
      setPasswordMessage(
        apiErrorMessage(err, "Could not update password. Check your current password.")
      );
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description={`Manage your ${roleConfig.label.toLowerCase()} account, preferences, and workspace`}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="w-full shrink-0 lg:w-64">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {sections.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cnSectionNav(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{activeMeta.label}</p>
              <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
            </div>
            {activeSection === "profile" && (
              <ProfileAvatarUploader
                name={fullName || displayName}
                username={user.username}
                role={user.profile?.role ?? role}
                avatarData={prefs.avatar_data || ""}
                onChange={saveAvatar}
                busy={updateProfile.isPending}
              />
            )}
          </div>

          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="full_name">Display name</Label>
                    <Input
                      id="full_name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1.5"
                      placeholder="Dr. Jane Smith"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5"
                      placeholder="name@hospital.org"
                    />
                  </div>
                  {isClinical && (
                    <div>
                      <Label>NICU ward / pod</Label>
                      <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
                        {assignedPodsDisplay}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Assigned by an administrator — you cannot change this here.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-2">
                  <SettingsRow label="Username" value={user.username} hint="Set by hospital IT — cannot be changed here" />
                  <SettingsRow
                    label="Role"
                    value={
                      <Badge variant="secondary" className="uppercase tracking-wide">
                        {roleConfig.label}
                      </Badge>
                    }
                  />
                  <SettingsRow label="Hospital" value={user.profile?.hospital ?? "—"} />
                  <SettingsRow label="Last sign-in" value={formatLastLogin(user.last_login)} />
                </div>

                {role === "admin" && (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="w-full text-xs text-muted-foreground">
                      Admin tools — ward assignment is managed for clinical staff in Manage Staff.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/users">
                        <Users className="mr-2 h-4 w-4" />
                        Manage Staff
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Color theme</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                      className="gap-2"
                    >
                      <Sun className="h-4 w-4" />
                      Light
                    </Button>
                    <Button
                      type="button"
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                      className="gap-2"
                    >
                      <Moon className="h-4 w-4" />
                      Dark
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Saved on this device. Applies across all staff sessions on this browser.
                  </p>
                </div>

                <SettingsToggle
                  id="dashboard_compact"
                  label="Compact dashboard layout"
                  description="Tighter spacing on overview cards and KPI rows."
                  checked={prefs.dashboard_compact}
                  onChange={(v) => updatePref("dashboard_compact", v)}
                />

                <div>
                  <Label htmlFor="time_format" className="mb-2 block">
                    Time format
                  </Label>
                  <select
                    id="time_format"
                    value={prefs.time_format}
                    onChange={(e) => updatePref("time_format", e.target.value as "12h" | "24h")}
                    className="flex h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="12h">12-hour (3:30 PM)</option>
                    <option value="24h">24-hour (15:30)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SettingsToggle
                  id="email_alerts"
                  label="Email digests"
                  description="Receive periodic email summaries of unacknowledged alerts (when configured by IT)."
                  checked={prefs.email_alerts}
                  onChange={(v) => updatePref("email_alerts", v)}
                />
                <SettingsToggle
                  id="high_risk_alerts"
                  label="High risk alerts"
                  description="Notify when a newborn is classified as High risk after assessment."
                  checked={prefs.high_risk_alerts}
                  onChange={(v) => updatePref("high_risk_alerts", v)}
                />
                <SettingsToggle
                  id="moderate_risk_alerts"
                  label="Moderate risk alerts"
                  description="Notify when a newborn is classified as Moderate risk."
                  checked={prefs.moderate_risk_alerts}
                  onChange={(v) => updatePref("moderate_risk_alerts", v)}
                />
                <SettingsToggle
                  id="chat_notifications"
                  label="Team chat messages"
                  description="Highlight new messages in Team Chat when you are mentioned or receive a direct message."
                  checked={prefs.chat_notifications}
                  onChange={(v) => updatePref("chat_notifications", v)}
                />
                <SettingsToggle
                  id="sound_alerts"
                  label="Sound on critical alerts"
                  description="Play a short tone when a critical alert arrives (browser permitting)."
                  checked={prefs.sound_alerts}
                  onChange={(v) => updatePref("sound_alerts", v)}
                />
              </CardContent>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="grid gap-4 sm:max-w-md" onSubmit={submitPassword}>
                  <p className="text-xs text-muted-foreground">
                    New password must be at least 8 characters and cannot be a common password
                    (for example <span className="font-mono">password123</span> is rejected).
                  </p>
                  <PasswordInput
                    id="current_password"
                    label="Current password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                  />
                  <PasswordInput
                    id="new_password"
                    label="New password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="At least 8 characters"
                  />
                  <PasswordInput
                    id="confirm_password"
                    label="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                  />
                  {passwordMessage && (
                    <p
                      className={cnMessage(
                        passwordMessage.includes("successfully") ? "success" : "error"
                      )}
                    >
                      {passwordMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      changePassword.isPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      newPassword.length < 8
                    }
                  >
                    {changePassword.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </form>

                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium">Session</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sign out on this device when you leave a shared workstation.
                  </p>
                  <Button variant="outline" className="mt-3" onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "workspace" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workspace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SettingsRow
                  label="Default landing page"
                  value={MODULE_LABELS[roleConfig.landing] ?? roleConfig.landing}
                  hint="Determined by your role"
                />
                <SettingsToggle
                  id="auto_refresh_dashboard"
                  label="Auto-refresh clinical overview"
                  description="Reload dashboard stats every few minutes while the tab is active."
                  checked={prefs.auto_refresh_dashboard}
                  onChange={(v) => updatePref("auto_refresh_dashboard", v)}
                />
                <SettingsToggle
                  id="assessment_confirm_before_submit"
                  label="Confirm before running assessment"
                  description="Show a final review step before submitting a new assessment."
                  checked={prefs.assessment_confirm_before_submit}
                  onChange={(v) => updatePref("assessment_confirm_before_submit", v)}
                />
              </CardContent>
            </Card>
          )}

          {activeSection === "access" && (
            <AccessSection role={role} />
          )}

          {activeSection !== "security" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveProfile} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              {saveMessage && (
                <span className="text-sm text-emerald-600">{saveMessage}</span>
              )}
              {updateProfile.isError && (
                <span className="text-sm text-destructive">Could not save — try again.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function AccessSection({ role }: { role: Role }) {
  const config = ROLES[role];
  const modules = config.modules === "*" ? Object.keys(MODULE_LABELS) : config.modules;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your role</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium text-foreground">{config.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(CAPABILITY_DETAILS) as Capability[]).map((cap) => {
            const allowed = config.capabilities.includes(cap);
            const detail = CAPABILITY_DETAILS[cap];
            return (
              <div
                key={cap}
                className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              >
                {allowed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <div>
                  <p className={cnCapLabel(allowed)}>{detail.label}</p>
                  <p className="text-xs text-muted-foreground">{detail.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Navigation access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {modules.map((href) => (
            <Badge key={href} variant="outline" className="text-xs">
              {MODULE_LABELS[href] ?? href}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Role changes and module access are managed by your hospital administrator.
        {role === "admin" ? (
          <>
            {" "}
            <Link to="/users" className="font-medium text-primary underline-offset-2 hover:underline">
              Open staff directory
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

function cnSectionNav(active: boolean) {
  return [
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
    active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ");
}

function cnMessage(variant: "success" | "error") {
  return variant === "success" ? "text-sm text-emerald-600" : "text-sm text-destructive";
}

function cnCapLabel(allowed: boolean) {
  return ["text-sm font-medium", allowed ? "text-foreground" : "text-muted-foreground"].join(" ");
}

function ProfileAvatarUploader({
  name,
  username,
  role,
  avatarData,
  onChange,
  busy,
}: {
  name: string;
  username?: string | null;
  role?: string | null;
  avatarData: string;
  onChange: (dataUrl: string) => void;
  busy?: boolean;
}) {
  const initials = name
    .replace(/^Dr\.\s+/i, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  const photoSrc = resolveStaffAvatar({
    avatarData,
    username,
    role,
  });

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) return;
    const dataUrl = await resizeImageToDataUrl(file, 160);
    onChange(dataUrl);
  }

  return (
    <div className="group relative flex shrink-0 items-center overflow-visible pr-14">
      <label className={cnAvatarLabel(busy)}>
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-card text-sm font-semibold text-muted-foreground transition group-hover:border-primary group-hover:text-primary">
          {photoSrc ? (
            <img src={photoSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground opacity-0 transition group-hover:opacity-100">
          {photoSrc ? "Change" : "Upload"}
        </span>
      </label>
      {photoSrc ? (
        <button
          type="button"
          disabled={busy}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive disabled:opacity-40"
          onClick={() => onChange(AVATAR_CLEARED)}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function cnAvatarLabel(busy?: boolean) {
  return ["relative cursor-pointer", busy ? "pointer-events-none opacity-70" : ""].join(" ");
}

