import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { useTeamChatUnread } from "@/hooks/useTeamChat";
import { cn, formatDateTime } from "@/lib/utils";

type ChatNavButtonProps = {
  active?: boolean;
};

/** Conversations shown in the popover before “view all”. */
const PREVIEW_LIMIT = 6;

/**
 * Staff chat notifications live on this MessageSquare control (teal badge) —
 * not the red Bell (that is Clinical Alerts).
 *
 * Many unreads: list stays capped + scrollable; full inbox is on /chat.
 */
export function ChatNavButton({ active }: ChatNavButtonProps) {
  const navigate = useNavigate();
  const { total, items } = useTeamChatUnread();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const preview = useMemo(() => items.slice(0, PREVIEW_LIMIT), [items]);
  const hiddenCount = Math.max(0, items.length - preview.length);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Staff chat — who texted you"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
          active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
          total > 0 && "border-teal-400/50 text-teal-700 dark:text-teal-300"
        )}
        aria-label={
          total > 0
            ? `Staff chat, ${total} unread message${total === 1 ? "" : "s"}`
            : "Staff chat notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MessageSquare className={cn("h-4 w-4", total > 0 && "bell-vibrate")} />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[9px] font-bold text-white">
            {total > 99 ? "99+" : total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 flex w-72 max-h-[min(24rem,70vh)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="shrink-0 border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Staff chat</p>
            <p className="text-[11px] text-muted-foreground">
              {total > 0
                ? `${total} unread across ${items.length} conversation${items.length === 1 ? "" : "s"}`
                : "No unread messages. Chat alerts appear here (teal), not on the red bell."}
            </p>
          </div>

          {preview.length > 0 ? (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {preview.map((item) => (
                <li key={item.convId}>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/60"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/chat?c=${encodeURIComponent(item.convId)}`);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                      <span className="shrink-0 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{item.preview}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(item.lastAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {hiddenCount > 0 ? (
            <p className="shrink-0 border-t border-border px-3 py-1.5 text-center text-[10px] text-muted-foreground">
              +{hiddenCount} more conversation{hiddenCount === 1 ? "" : "s"} in Staff Chat
            </p>
          ) : null}

          <div className="shrink-0 border-t border-border p-2">
            <Link
              to="/chat"
              className="block rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-primary hover:bg-primary/10"
              onClick={() => setOpen(false)}
            >
              Open Staff Chat
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
