import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navSections } from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTeamChatUnread } from "@/hooks/useTeamChat";
import type { Role } from "@/lib/roles";

/** Role-aware mobile destinations (sidebar is hidden below lg). */
const MOBILE_HREFS_BY_ROLE: Record<Role, string[]> = {
  nurse: ["/", "/my-patients", "/newborns/register", "/notifications", "/chat", "/settings"],
  doctor: ["/", "/my-patients", "/newborns/register", "/notifications", "/chat", "/settings"],
  admin: ["/", "/newborns", "/users", "/notifications", "/pods", "/reports", "/settings"],
};

export function MobileNav() {
  const location = useLocation();
  const { canAccess, can, role, authed } = useAuth();
  const { total: chatUnread } = useTeamChatUnread({ enabled: authed });

  const allowedHrefs = MOBILE_HREFS_BY_ROLE[role] ?? MOBILE_HREFS_BY_ROLE.nurse;

  const items = navSections
    .flatMap((s) => s.items)
    .filter(
      (item) =>
        allowedHrefs.includes(item.href) &&
        canAccess(item.href) &&
        (!item.capability || can(item.capability)) &&
        (!item.roles || item.roles.includes(role))
    )
    .slice(0, 6);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-stretch justify-around px-1 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match
            ? item.match(location.pathname)
            : location.pathname === item.href;
          const showChatBadge = item.href === "/chat" && chatUnread > 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                to={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
                aria-label={
                  showChatBadge
                    ? `${item.label}, ${chatUnread} unread`
                    : item.label
                }
              >
                <span className="relative">
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  {showChatBadge && (
                    <span className="absolute -right-2 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-teal-500 px-0.5 text-[8px] font-bold text-white">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
