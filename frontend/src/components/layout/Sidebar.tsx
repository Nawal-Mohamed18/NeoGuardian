import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { navSections } from "@/config/navigation";
import { Activity, LogOut } from "lucide-react";
import { StaffAvatar } from "@/components/shared/StaffAvatar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { canAccess, can, signOut, roleConfig, displayName, role, user } = useAuth();
  const { label } = roleConfig;
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function keepExpanded() {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    onExpandedChange(true);
  }

  function scheduleCollapse() {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      onExpandedChange(false);
      leaveTimerRef.current = null;
    }, 200);
  }

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          canAccess(item.href) &&
          (!item.capability || can(item.capability)) &&
          (!item.roles || item.roles.includes(role))
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      onMouseEnter={keepExpanded}
      onMouseLeave={scheduleCollapse}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col overflow-visible bg-sidebar text-white lg:flex",
        "rounded-tr-[2rem] transition-[width] duration-300 ease-out",
        expanded ? "w-56" : "w-16"
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2.5 overflow-hidden border-b border-white/10 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-teal-400 to-primary">
          <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200",
            expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"
          )}
        >
          <p className="truncate text-sm font-bold leading-tight">NeoGuardian</p>
          <p className="truncate text-[10px] text-sidebar-muted">NICU Decision Support</p>
        </div>
      </div>

      <nav className="flex-1 overflow-x-visible overflow-y-auto overscroll-contain py-4 pl-2 pr-0" aria-label="Main navigation">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className={cn(i > 0 && "mt-3")}>
            {section.title && (
              <p
                className={cn(
                  "overflow-hidden px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-sidebar-muted/70 whitespace-nowrap transition-all duration-200",
                  expanded ? "max-h-6 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {section.title}
              </p>
            )}
            <ul className="space-y-1.5 overflow-visible">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.match
                  ? item.match(location.pathname)
                  : location.pathname === item.href;

                return (
                  <li key={item.href} className="relative overflow-visible">
                    <Link
                      to={item.href}
                      title={item.label}
                      onClick={keepExpanded}
                      onMouseDown={keepExpanded}
                      className={cn(
                        "group relative z-10 flex w-full items-center gap-2.5 py-2.5 text-[13px] font-medium transition-colors",
                        expanded ? "justify-start px-2.5" : "justify-center px-0",
                        active
                          ? "sidebar-nav-active text-primary"
                          : "text-sidebar-muted hover:bg-white/5 hover:text-white"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && (
                        <motion.span
                          key={`sidebar-notch-${theme}`}
                          layoutId={`sidebar-active-notch-${theme}`}
                          className="sidebar-nav-active-surface absolute inset-0 -z-10"
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                      <Icon
                        className={cn(
                          "relative z-10 h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-sidebar-muted group-hover:text-white"
                        )}
                      />
                      <span
                        className={cn(
                          "relative z-10 overflow-hidden whitespace-nowrap transition-all duration-200",
                          expanded ? "max-w-36 opacity-100" : "max-w-0 opacity-0",
                          active && "font-semibold"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 overflow-hidden border-t border-white/10 p-2">
        <div className={cn("flex items-center gap-1 rounded-md py-1", expanded ? "px-1" : "px-1.5")}>
          <Link
            to="/settings"
            title="Settings"
            aria-label="Open settings"
            onClick={keepExpanded}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-white/5",
              expanded ? "px-2" : "justify-center px-1.5"
            )}
          >
            <StaffAvatar
              name={displayName}
              username={user?.username}
              role={user?.profile?.role ?? role}
              avatarData={user?.profile?.preferences?.avatar_data}
              size="xs"
              className="border-white/20"
              fallbackClassName="bg-teal-500/20 text-teal-200"
            />
            <div
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200",
                expanded ? "max-w-32 flex-1 opacity-100" : "max-w-0 flex-none opacity-0"
              )}
            >
              <p className="truncate text-xs font-semibold text-white">{displayName}</p>
              <p className="truncate text-[10px] text-sidebar-muted">{label}</p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className={cn(
              "shrink-0 rounded-md p-1.5 text-sidebar-muted transition-all duration-200 hover:bg-white/5 hover:text-white",
              expanded ? "max-w-8 opacity-100" : "max-w-0 overflow-hidden p-0 opacity-0"
            )}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
