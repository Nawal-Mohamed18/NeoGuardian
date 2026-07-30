import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ChatNavButton } from "@/components/layout/ChatNavButton";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import { cn } from "@/lib/utils";

interface TopNavProps {
  alertCount?: number;
}

function useNow(tickMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Sticky title bar: rounded inset at rest, full-width after scroll.
 * Outer height stays fixed so padding/radius changes cannot create a
 * scrollbar feedback loop (vibration) on tall pages like Staff Chat.
 */
export function TopNav({ alertCount }: TopNavProps) {
  const dateLabel = useNow();
  const { roleConfig, displayName, canAccess, authed } = useAuth();
  const location = useLocation();
  const chatActive = location.pathname.startsWith("/chat");
  const { data: alerts = [] } = useAlerts({ enabled: authed });
  const liveCount = alerts.filter((a) => !a.acknowledged).length;
  const unread = alertCount ?? liveCount;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // Hysteresis: avoid flip-flopping around the threshold.
      setScrolled((wasScrolled) => (wasScrolled ? y > 2 : y > 10));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-14 shrink-0">
      <div
        className={cn(
          "flex h-12 items-center gap-3 bg-card/95 px-4 backdrop-blur transition-[margin,border-radius,box-shadow] duration-300 ease-out lg:px-5",
          chatActive || scrolled
            ? "mx-0 mt-0 rounded-none border-0 border-b border-border shadow-none"
            : "mx-3 mt-2 rounded-2xl border border-border shadow-sm sm:mx-4"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {dateLabel} · {roleConfig.label}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {canAccess("/chat") && <ChatNavButton active={chatActive} />}

          <Link
            to="/notifications"
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
              "text-red-600 dark:text-red-400"
            )}
            aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}
          >
            <Bell className={cn("h-4 w-4", unread > 0 && "bell-vibrate")} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
