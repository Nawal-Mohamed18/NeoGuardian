import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ROLES,
  DEFAULT_ROLE,
  normalizeRole,
  hasCapability,
  isModuleAllowed,
  canViewPHI as roleCanViewPHI,
  type Capability,
  type Role,
  type RoleConfig,
} from "@/lib/roles";
import {
  authApi,
  storeTokens,
  storeUser,
  getStoredUser,
  getUsername,
  clearTokens,
  roleFromAuthUser,
  hasValidSession,
} from "@/lib/api";
import type { AuthUser } from "@/types/clinical";

const ROLE_KEY = "ng_role";
const HEARTBEAT_MS = 45_000;

interface AuthContextValue {
  authed: boolean;
  role: Role;
  roleConfig: RoleConfig;
  displayName: string;
  user: AuthUser | null;
  canViewPHI: boolean;
  can: (capability: Capability) => boolean;
  canAccess: (href: string) => boolean;
  signIn: (role?: Role) => void;
  signInWithCredentials: (username: string, password: string) => Promise<Role>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAuthed(): boolean {
  return hasValidSession();
}

function readRole(): Role {
  try {
    const stored = localStorage.getItem(ROLE_KEY);
    return normalizeRole(stored) ?? DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

function resolveDisplayName(user: AuthUser | null, role: Role): string {
  return user?.profile?.full_name || getUsername() || ROLES[role].label;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(readAuthed);
  const [role, setRoleState] = useState<Role>(readRole);
  const [user, setUser] = useState<AuthUser | null>(() => (readAuthed() ? getStoredUser() : null));

  const persistRole = useCallback((next: Role) => {
    setRoleState(next);
    try {
      localStorage.setItem(ROLE_KEY, next);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const signIn = useCallback(
    (nextRole?: Role) => {
      if (nextRole) persistRole(nextRole);
      if (!hasValidSession()) return;
      setAuthed(true);
    },
    [persistRole]
  );

  const signInWithCredentials = useCallback(
    async (username: string, password: string): Promise<Role> => {
      const data = await authApi.login(username, password);
      storeTokens(data.access, data.refresh, username);
      storeUser(data.user);
      setUser(data.user);
      const role = normalizeRole(data.role) ?? roleFromAuthUser(data.user) ?? DEFAULT_ROLE;
      persistRole(role);
      setAuthed(true);
      return role;
    },
    [persistRole]
  );

  const signOut = useCallback(() => {
    setAuthed(false);
    setRoleState(DEFAULT_ROLE);
    setUser(null);
    clearTokens();
    try {
      localStorage.removeItem(ROLE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!hasValidSession()) return;
    const me = await authApi.me();
    storeUser(me);
    setUser(me);
    const nextRole = normalizeRole(me.profile?.role ?? me.role) ?? role;
    persistRole(nextRole);
  }, [persistRole, role]);

  useEffect(() => {
    if (!authed || !hasValidSession()) return;

    let cancelled = false;
    const beat = () => {
      void authApi
        .heartbeat()
        .then((me) => {
          if (cancelled) return;
          storeUser(me);
          setUser(me);
        })
        .catch(() => {
          /* ignore transient heartbeat failures */
        });
    };

    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authed]);

  const displayName = resolveDisplayName(user, role);

  const value = useMemo<AuthContextValue>(
    () => ({
      authed,
      role,
      roleConfig: ROLES[role],
      displayName,
      user,
      canViewPHI: roleCanViewPHI(role),
      can: (capability: Capability) => hasCapability(role, capability),
      canAccess: (href: string) => isModuleAllowed(role, href),
      signIn,
      signInWithCredentials,
      signOut,
      refreshUser,
    }),
    [authed, role, displayName, user, signIn, signInWithCredentials, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
