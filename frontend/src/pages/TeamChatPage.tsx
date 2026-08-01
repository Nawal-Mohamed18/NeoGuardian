import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Send,
  Loader2,
  Search,
  ChevronDown,
  Stethoscope,
  Megaphone,
  ArrowDown,
  MessageSquareText,
  Paperclip,
  Smile,
  X,
  Camera,
  Check,
  CheckCheck,
  Pin,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeamChat, useSendTeamMessage, useDeleteTeamMessage, useMarkTeamChatSeen } from "@/hooks/useTeamChat";
import { useClinicalStaff } from "@/hooks/useClinicalStaff";
import { useUpdateProfile } from "@/hooks/useSettings";
import { useAuth } from "@/context/AuthContext";
import { getUsername } from "@/lib/api";
import { cn } from "@/lib/utils";
import { resolveStaffAvatar, resizeImageToDataUrl } from "@/lib/avatarImage";
import type { TeamMessage } from "@/types";
import {
  AvatarCircle,
  PatientPill,
  PLACEHOLDER,
  RoleBadge,
} from "@/components/team-chat/StaffChatUi";
import {
  QUICK_TEMPLATES,
  buildConversations,
  daySeparatorLabel,
  filterConversations,
  formatActivity,
  formatClock,
  formatLastSeen,
  loadDraft,
  loadPins,
  loadReadMap,
  markConversationRead,
  saveDraft,
  togglePin,
  unreadCount,
  type Conversation,
  type ConversationFilter,
} from "@/lib/teamChatConversations";
import {
  EMOJI_GROUPS,
  encodeImageAttachment,
  fileToCompressedDataUrl,
  parseMessageBody,
  plainTextForCopy,
} from "@/lib/teamChatAttachments";

type Priority = "routine" | "urgent" | "critical";
type PendingImage = { id: string; name: string; dataUrl: string };

const PRIORITY_TAG: Record<Priority, string> = {
  routine: "",
  urgent: "[Urgent] ",
  critical: "[Critical] ",
};

function SkeletonPane() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card lg:rounded-2xl lg:border lg:border-border lg:shadow-sm">
      <div className="border-b border-border p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        {[0, 1].map((col) => (
          <div key={col} className="min-h-0 space-y-3 border-border p-4 lg:border-r lg:last:border-r-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3">
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveryTicks({
  status,
  onOwnBubble,
}: {
  status?: TeamMessage["delivery_status"];
  onOwnBubble?: boolean;
}) {
  if (!status) return null;
  const tone =
    status === "seen"
      ? "text-sky-300"
      : onOwnBubble
        ? "text-white/75"
        : "text-slate-400";
  const title =
    status === "seen" ? "Seen" : status === "delivered" ? "Delivered" : "Sent";
  if (status === "sent") {
    return <Check className={cn("h-3 w-3 shrink-0", tone)} aria-label={title} title={title} />;
  }
  return <CheckCheck className={cn("h-3.5 w-3.5 shrink-0", tone)} aria-label={title} title={title} />;
}

function MessageCard({
  msg,
  isOwn,
  isBroadcast,
  avatarSrc,
  online,
  showUnreadDivider,
  onCopy,
  onPin,
  onDelete,
  pinned,
  deleting,
}: {
  msg: TeamMessage;
  isOwn: boolean;
  isBroadcast: boolean;
  avatarSrc?: string | null;
  online?: boolean;
  showUnreadDivider?: boolean;
  onCopy: () => void;
  onPin: () => void;
  onDelete: (mode: "for_me" | "for_everyone") => void;
  pinned: boolean;
  deleting?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isDeleted = Boolean(msg.is_deleted);
  const parsed = isDeleted ? { text: msg.body, images: [] as { name: string; src: string }[] } : parseMessageBody(msg.body);
  return (
    <>
      {showUnreadDivider && (
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-rose-200 dark:bg-rose-900/60" />
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            New
          </span>
          <div className="h-px flex-1 bg-rose-200 dark:bg-rose-900/60" />
        </div>
      )}
      <div
        className={cn(
          "group relative flex min-w-0 gap-2",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}
      >
        <AvatarCircle
          name={isOwn ? "You" : msg.sender_name}
          role={msg.sender_role}
          src={avatarSrc}
          size="sm"
          online={online}
        />
        <div className={cn("relative min-w-0 w-full max-w-[min(92%,40rem)]", isOwn && "items-end")}>
          <div
            className={cn(
              "rounded-2xl px-3 py-1.5 shadow-sm",
              isDeleted && "border border-dashed border-slate-300 bg-transparent dark:border-slate-600",
              !isDeleted && isOwn && !isBroadcast && "rounded-br-md bg-[#14B8A6] text-white",
              !isDeleted && isOwn && isBroadcast && "rounded-br-md border border-amber-300 bg-amber-500 text-white",
              !isDeleted && !isOwn && isBroadcast && "rounded-bl-md border border-amber-200 bg-amber-50 text-slate-900 dark:border-amber-700/50 dark:bg-amber-950/45 dark:text-amber-50",
              !isDeleted && !isOwn && !isBroadcast && "rounded-bl-md border border-border bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            )}
          >
            <div className="mb-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  isDeleted
                    ? "text-slate-500 dark:text-slate-400"
                    : isOwn
                      ? "text-white/95"
                      : "text-slate-900 dark:text-slate-100"
                )}
              >
                {isOwn ? "You" : msg.sender_name}
              </span>
              {!isDeleted && (
                <RoleBadge
                  role={isBroadcast ? "broadcast" : msg.sender_role}
                  className={cn(
                    "scale-90 origin-left",
                    isOwn ? "border-white/30 bg-white/15 text-white" : undefined
                  )}
                />
              )}
              {!isDeleted && msg.patient_code ? (
                <PatientPill
                  code={msg.patient_code}
                  tone={isOwn ? "onTeal" : isBroadcast ? "onBroadcast" : "default"}
                />
              ) : null}
              {pinned && !isDeleted && (
                <span className="rounded bg-white/20 px-1 text-[9px] font-semibold">Pinned</span>
              )}
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-0.5 text-[9px]",
                  isDeleted
                    ? "text-slate-400"
                    : isOwn
                      ? "text-white/65"
                      : "text-slate-400 dark:text-slate-500"
                )}
              >
                {formatClock(msg.created_at)}
                {isOwn && !isDeleted ? (
                  <DeliveryTicks status={msg.delivery_status ?? "sent"} onOwnBubble />
                ) : null}
              </span>
            </div>
            {isDeleted ? (
              <p className="italic text-[13px] leading-snug text-slate-500 dark:text-slate-400">
                {parsed.text || "This message was deleted"}
              </p>
            ) : (
              <>
                {parsed.text ? (
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-[13px] leading-snug",
                      isOwn ? "text-white" : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {parsed.text}
                  </p>
                ) : null}
                {parsed.images.length > 0 && (
                  <div className={cn("space-y-1.5", parsed.text && "mt-1.5")}>
                    {parsed.images.map((img) => (
                      <a
                        key={`${img.name}-${img.src.slice(-24)}`}
                        href={img.src}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        title={img.name}
                      >
                        <img src={img.src} alt={img.name} className="max-h-36 w-full object-contain" />
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {!isDeleted && (
            <div
              className={cn(
                "pointer-events-none absolute top-full z-10 mt-0.5 flex flex-wrap gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100",
                deleteOpen && "pointer-events-auto opacity-100",
                isOwn ? "right-0" : "left-0"
              )}
            >
              <button
                type="button"
                onClick={onCopy}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Copy
              </button>
              {isBroadcast && (
                <button
                  type="button"
                  onClick={onPin}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {pinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeleteOpen((v) => !v)}
                disabled={deleting}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Delete
              </button>
              {deleteOpen && (
                <div className="flex w-full flex-col gap-0.5 border-t border-slate-100 pt-0.5 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteOpen(false);
                      onDelete("for_me");
                    }}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Delete for me
                  </button>
                  {msg.can_delete_for_everyone !== false && isOwn && (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setDeleteOpen(false);
                        onDelete("for_everyone");
                      }}
                      className="rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Delete for everyone
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function TeamChatPage() {
  const { role, user } = useAuth();
  const username = getUsername() || user?.username || "";
  const ward =
    user?.profile?.ward ||
    user?.profile?.wards?.[0] ||
    "NICU";
  const { data: messages = [], isLoading, isError } = useTeamChat();
  const { data: staff = [] } = useClinicalStaff({ refetchInterval: 30_000 });
  const send = useSendTeamMessage();
  const deleteMsg = useDeleteTeamMessage();
  const markSeen = useMarkTeamChatSeen();
  const updateProfile = useUpdateProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeId, setActiveId] = useState("broadcast");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [convSearch, setConvSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [body, setBody] = useState("");
  const [patientCode, setPatientCode] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [priority, setPriority] = useState<Priority>("routine");
  const [toast, setToast] = useState("");
  const [newBanner, setNewBanner] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [readMap, setReadMap] = useState<Record<string, string>>(() =>
    username ? loadReadMap(username) : {}
  );
  const [pins, setPins] = useState<number[]>(() => (username ? loadPins(username) : []));
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [unreadAnchorId, setUnreadAnchorId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const knownIdsRef = useRef<Set<number>>(new Set());

  const conversations = useMemo(
    () => buildConversations(messages, username, staff),
    [messages, username, staff]
  );

  // Deep-link from TopNav "who texted you" -> /chat?c=dm:user or broadcast
  useEffect(() => {
    const c = searchParams.get("c");
    if (!c || !conversations.length) return;
    const conv = conversations.find((x) => x.id === c);
    if (!conv) return;
    const map = username ? loadReadMap(username) : {};
    const since = map[conv.id];
    let anchor: number | null = null;
    if (!since) {
      anchor = conv.messages.find((m) => m.sender_username !== username)?.id ?? null;
    } else {
      const t = new Date(since).getTime();
      anchor =
        conv.messages.find(
          (m) => m.sender_username !== username && new Date(m.created_at).getTime() > t
        )?.id ?? null;
    }
    setUnreadAnchorId(anchor);
    setActiveId(conv.id);
    setMobilePane("chat");
    if (conv.kind === "direct") setRecipientUsername(conv.peerUsername || "");
    else setRecipientUsername("");
    setSearchParams({}, { replace: true });
  }, [searchParams, conversations, username, setSearchParams]);

  const avatarByUsername = useMemo(() => {
    const map: Record<string, string> = {};
    const put = (uname?: string | null, staffRole?: string | null, data?: string | null) => {
      if (!uname) return;
      const next = resolveStaffAvatar({
        avatarData: data,
        username: uname,
        role: staffRole,
      });
      const prev = map[uname];
      if (!prev || (data && String(data).startsWith("data:image/"))) {
        map[uname] = next;
      }
    };
    for (const s of staff) {
      put(s.username, s.profile?.role ?? s.role, s.profile?.preferences?.avatar_data);
    }
    for (const m of messages) {
      put(m.sender_username, m.sender_role, m.sender_avatar);
    }
    put(
      username,
      role || user?.profile?.role,
      user?.profile?.preferences?.avatar_data
    );
    return map;
  }, [staff, messages, username, role, user?.profile?.role, user?.profile?.preferences?.avatar_data]);

  const presenceByUsername = useMemo(() => {
    const map: Record<string, { online: boolean; lastSeen: string | null }> = {};
    for (const s of staff) {
      map[s.username] = {
        online: Boolean(s.is_online),
        lastSeen: s.last_seen_at ?? null,
      };
    }
    if (username) {
      map[username] = {
        online: true,
        lastSeen: user?.last_seen_at ?? new Date().toISOString(),
      };
    }
    return map;
  }, [staff, username, user?.last_seen_at]);

  const myAvatarSrc = username
    ? avatarByUsername[username] ||
      resolveStaffAvatar({
        avatarData: user?.profile?.preferences?.avatar_data,
        username,
        role: role || user?.profile?.role,
      })
    : "";
  const myDisplayName = user?.profile?.full_name || username || "You";

  async function onChangeMyAvatar(file: File | undefined) {
    if (!file || updateProfile.isPending) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 160);
      await updateProfile.mutateAsync({ preferences: { avatar_data: dataUrl } });
      showToast("Profile photo updated");
    } catch {
      showToast("Could not update photo");
    }
  }

  const visibleConversations = useMemo(
    () => filterConversations(conversations, filter, convSearch),
    [conversations, filter, convSearch]
  );
  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  useEffect(() => {
    if (!active && conversations[0]) setActiveId(conversations[0].id);
  }, [active, conversations]);

  useEffect(() => {
    if (!username || !active) return;
    const draft = loadDraft(username, active.id);
    setBody(draft);
    setRecipientUsername(active.kind === "direct" ? active.peerUsername || "" : "");
    setPatientCode(active.patientCode || "");
  }, [active?.id, username]);

  useEffect(() => {
    if (!username || !active) return;
    const t = setTimeout(() => saveDraft(username, active.id, body), 300);
    return () => clearTimeout(t);
  }, [body, active?.id, username]);

  useEffect(() => {
    if (!username || !active?.lastAt) return;
    const t = setTimeout(() => {
      markConversationRead(username, active.id, new Date().toISOString());
      setReadMap(loadReadMap(username));
      // WhatsApp-style: opening the thread marks their messages as seen for the sender's blue ticks
      markSeen.mutate({ conversation_id: active.id });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSeen identity changes; fire on thread focus
  }, [active?.id, active?.lastAt, username, messages.length]);

  function selectConversation(conv: Conversation) {
    const map = username ? loadReadMap(username) : {};
    const since = map[conv.id];
    let anchor: number | null = null;
    if (!since) {
      anchor = conv.messages.find((m) => m.sender_username !== username)?.id ?? null;
    } else {
      const t = new Date(since).getTime();
      anchor =
        conv.messages.find(
          (m) => m.sender_username !== username && new Date(m.created_at).getTime() > t
        )?.id ?? null;
    }
    setUnreadAnchorId(anchor);
    setActiveId(conv.id);
    setMobilePane("chat");
    if (conv.kind === "direct") setRecipientUsername(conv.peerUsername || "");
    else setRecipientUsername("");
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (emojiRef.current && !emojiRef.current.contains(t)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    const ids = new Set(messages.map((m) => m.id));
    if (knownIdsRef.current.size === 0) {
      knownIdsRef.current = ids;
      prevLenRef.current = messages.length;
      return;
    }
    let added = 0;
    for (const id of ids) {
      if (!knownIdsRef.current.has(id)) added += 1;
    }
    if (added > 0) {
      setNewBanner(added);
      const t = setTimeout(() => setNewBanner(0), 2800);
      knownIdsRef.current = ids;
      return () => clearTimeout(t);
    }
    knownIdsRef.current = ids;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [active?.id, active?.messages.length, scrollToBottom]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(dist > 120);
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  }

  async function handleSend() {
    const text = body.trim();
    if ((!text && pendingImages.length === 0) || send.isPending) return;
    const tagged = `${PRIORITY_TAG[priority]}${text}`.trim();
    const attachmentBlock = pendingImages
      .map((img) => encodeImageAttachment(img.name, img.dataUrl))
      .join("\n");
    const fullBody = [tagged, attachmentBlock].filter(Boolean).join("\n");
    await send.mutateAsync({
      body: fullBody,
      patient_code: patientCode.trim() || undefined,
      recipient_username: recipientUsername || null,
    });
    setBody("");
    setPendingImages([]);
    if (username && active) saveDraft(username, active.id, "");
    setPriority("routine");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    showToast("Message sent");
    scrollToBottom(true);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + emoji);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + emoji + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setAttaching(true);
    try {
      const next: PendingImage[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        const { name, dataUrl } = await fileToCompressedDataUrl(file);
        next.push({ id: `${Date.now()}-${name}`, name, dataUrl });
      }
      setPendingImages((prev) => [...prev, ...next].slice(0, 4));
      showToast(next.length === 1 ? "Image attached" : `${next.length} images attached`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not attach file");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const threadMessages = useMemo(() => {
    if (!active) return [];
    const q = msgSearch.trim().toLowerCase();
    if (!q) return active.messages;
    return active.messages.filter(
      (m) =>
        m.body.toLowerCase().includes(q) ||
        m.sender_name.toLowerCase().includes(q) ||
        (m.patient_code || "").toLowerCase().includes(q)
    );
  }, [active, msgSearch]);

  const pinnedMessages = useMemo(() => {
    if (!active) return [];
    const pinSet = new Set(pins);
    // Newest pins first so the compact preview stays useful as the list grows.
    return active.messages.filter((m) => pinSet.has(m.id)).reverse();
  }, [active, pins]);

  const [pinsOpen, setPinsOpen] = useState(false);

  useEffect(() => {
    setPinsOpen(false);
  }, [active?.id]);

  function jumpToPinned(messageId: number) {
    setPinsOpen(false);
    const el = document.getElementById(`teamchat-msg-${messageId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-amber-400", "ring-offset-2");
    window.setTimeout(() => {
      el?.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
    }, 1600);
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <AppLayout immersive>
        <SkeletonPane />
      </AppLayout>
    );
  }

  return (
    <AppLayout immersive>
      <div
        className="staff-chat relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card text-foreground lg:rounded-2xl lg:border lg:border-border lg:shadow-sm"
      >
        {/* Title strip - single compact line + own photo */}
        <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-base">
              Staff Communication
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="hidden rounded-full border border-border bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 md:inline">
              {dateLabel}
            </span>
            <span className="inline-flex max-w-[8rem] items-center gap-1 truncate rounded-full border border-border bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5">
              <Stethoscope className="h-3 w-3 shrink-0 text-[#14B8A6]" />
              <span className="truncate">{ward}</span>
            </span>
            <label
              className={cn(
                "group relative flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-slate-50 dark:bg-slate-800/70 py-0.5 pl-0.5 pr-2 transition hover:border-teal-200 hover:bg-teal-50/80 dark:hover:border-teal-700 dark:hover:bg-teal-950/40",
                updateProfile.isPending && "pointer-events-none opacity-60"
              )}
              title="Change your profile photo"
            >
              <span className="relative">
                <AvatarCircle
                  name={myDisplayName}
                  role={role || user?.profile?.role}
                  src={myAvatarSrc}
                  size="sm"
                  online
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-3 w-3 text-white" />
                </span>
              </span>
              <span className="hidden text-[10px] font-semibold text-slate-900 dark:text-slate-100 sm:inline">
                {updateProfile.isPending ? "Saving..." : "Your photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={updateProfile.isPending}
                onChange={(e) => {
                  void onChangeMyAvatar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </header>

        {isError && (
          <p className="shrink-0 border-b border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            Could not load messages. Is the backend running?
          </p>
        )}

        {toast && (
          <div className="pointer-events-none fixed bottom-[5.5rem] left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900 shadow-lg transition-all duration-200 lg:bottom-8">
            {toast}
          </div>
        )}

        <div className="grid min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900/80 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left: conversations */}
          <aside
            className={cn(
              "flex min-h-0 flex-col border-border bg-card lg:border-r",
              mobilePane === "chat" ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="shrink-0 space-y-2 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="h-9 border-slate-200 bg-slate-50 pl-8 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
                />
              </div>
              <div className="flex gap-1">
                {(
                  [
                    ["all", "All"],
                    ["broadcast", "Broadcast"],
                    ["direct", "Direct"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "flex-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors duration-150",
                      filter === key
                        ? "bg-[#14B8A6] text-white shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-2">
              {visibleConversations.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No conversations match.</p>
              ) : (
                visibleConversations.map((conv) => {
                  const unread = unreadCount(conv, username, readMap);
                  const activeRow = conv.id === active?.id;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        "mb-1.5 flex w-full gap-2.5 rounded-2xl border border-transparent p-2.5 text-left transition-colors duration-150 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80",
                        activeRow && "border-teal-200 bg-teal-50/80 shadow-sm dark:border-teal-700/70 dark:bg-teal-950/45"
                      )}
                    >
                      <AvatarCircle
                        name={conv.title}
                        role={conv.kind === "broadcast" ? "broadcast" : conv.role}
                        src={
                          conv.kind === "broadcast"
                            ? undefined
                            : avatarByUsername[conv.peerUsername || ""]
                        }
                        size="md"
                        online={
                          conv.kind === "direct" &&
                          Boolean(presenceByUsername[conv.peerUsername || ""]?.online)
                        }
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {conv.kind === "broadcast" ? "Everyone" : conv.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                            {formatActivity(conv.lastAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <RoleBadge role={conv.kind === "broadcast" ? "broadcast" : conv.role} />
                          {conv.kind === "direct" && conv.podName ? (
                            <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {conv.podName}
                            </span>
                          ) : null}
                          {unread > 0 && (
                            <span className="shrink-0 rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">
                              {unread}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {conv.lastMessage
                            ? parseMessageBody(conv.lastMessage).text ||
                              (parseMessageBody(conv.lastMessage).images.length
                                ? "Photo"
                                : "No messages yet")
                            : "No messages yet — tap to start"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Center: thread */}
          <section
            className={cn(
              "relative flex min-h-0 min-w-0 flex-col bg-slate-50 dark:bg-slate-900/60",
              mobilePane === "list" ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2 py-1.5 sm:px-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="mb-0.5 text-[11px] font-semibold text-[#14B8A6] lg:hidden"
                  onClick={() => setMobilePane("list")}
                >
                  {"\u2190"} Conversations
                </button>
                <div className="flex min-w-0 items-center gap-2">
                  {active && (
                    <AvatarCircle
                      name={active.title}
                      role={active.kind === "broadcast" ? "broadcast" : active.role}
                      src={
                        active.kind === "broadcast"
                          ? undefined
                          : avatarByUsername[active.peerUsername || ""]
                      }
                      size="sm"
                      online={
                        active.kind === "direct" &&
                        Boolean(presenceByUsername[active.peerUsername || ""]?.online)
                      }
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {active?.kind === "broadcast" ? "Everyone" : active?.title}
                      </p>
                      {active && (
                        <RoleBadge role={active.kind === "broadcast" ? "broadcast" : active.role} />
                      )}
                    </div>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {active
                        ? active.kind === "broadcast"
                          ? formatLastSeen(active.lastAt, "broadcast")
                          : presenceByUsername[active.peerUsername || ""]?.online
                            ? "online"
                            : formatLastSeen(
                                presenceByUsername[active.peerUsername || ""]?.lastSeen ?? null,
                                "direct"
                              )
                        : "Select a conversation"}
                      {active?.patientCode ? ` \u00b7 ${active.patientCode}` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative hidden w-36 shrink-0 sm:block sm:w-44">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Search"
                  className="h-7 border-slate-200 bg-slate-50 pl-7 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
                />
              </div>
            </div>

            {newBanner > 0 && (
              <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-full bg-[#14B8A6] px-3 py-1 text-xs font-semibold text-white shadow-md transition-all duration-200">
                {newBanner} new message{newBanner === 1 ? "" : "s"}
              </div>
            )}

            {pinnedMessages.length > 0 && (
              <div className="relative z-10 shrink-0 border-b border-amber-200/80 bg-amber-50/95 px-3 py-1.5 dark:border-amber-700/40 dark:bg-amber-950/50 sm:px-5">
                <button
                  type="button"
                  onClick={() => setPinsOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-amber-100/70 dark:hover:bg-amber-900/40"
                  aria-expanded={pinsOpen}
                >
                  <Pin className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-800 dark:text-slate-100">
                    <span className="font-semibold text-amber-800 dark:text-amber-200">
                      {pinnedMessages.length} pinned
                    </span>
                    {!pinsOpen && pinnedMessages[0] ? (
                      <>
                        <span className="text-slate-400">{" \u00b7 "}</span>
                        <span className="font-medium">{pinnedMessages[0].sender_name}: </span>
                        {pinnedMessages[0].body}
                      </>
                    ) : null}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-amber-700 transition-transform dark:text-amber-300",
                      pinsOpen && "rotate-180"
                    )}
                  />
                </button>
                {pinsOpen && (
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-amber-200/80 bg-card/90 p-1.5 dark:border-amber-700/40 dark:bg-slate-900/90">
                    {pinnedMessages.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/50"
                      >
                        <button
                          type="button"
                          onClick={() => jumpToPinned(m.id)}
                          className="min-w-0 flex-1 px-2 py-1.5 text-left text-xs text-slate-800 dark:text-slate-100"
                        >
                          <span className="font-semibold">{m.sender_name}: </span>
                          <span className="line-clamp-2">{m.body}</span>
                        </button>
                        <button
                          type="button"
                          title="Unpin"
                          className="mt-1 shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/60"
                          onClick={() => {
                            if (!username) return;
                            setPins(togglePin(username, m.id));
                          }}
                        >
                          Unpin
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              ref={threadRef}
              onScroll={onThreadScroll}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-5 lg:px-6"
            >
              {!threadMessages.length ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-[#14B8A6] shadow-sm">
                    <MessageSquareText className="h-7 w-7" />
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">No messages yet.</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                    Start a conversation with your NICU team or send a broadcast update.
                  </p>
                </div>
              ) : (
                threadMessages.map((msg, idx) => {
                  const prev = threadMessages[idx - 1];
                  const showDay =
                    !prev ||
                    daySeparatorLabel(prev.created_at) !== daySeparatorLabel(msg.created_at);
                  const isOwn = !!username && msg.sender_username === username;
                  return (
                    <div key={msg.id} id={`teamchat-msg-${msg.id}`} className="min-w-0 rounded-xl transition">
                      {showDay && (
                        <div className="my-1.5 flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {daySeparatorLabel(msg.created_at)}
                          </span>
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                        </div>
                      )}
                      <MessageCard
                        msg={msg}
                        isOwn={isOwn}
                        isBroadcast={msg.is_broadcast}
                        online={
                          isOwn
                            ? true
                            : Boolean(presenceByUsername[msg.sender_username]?.online)
                        }
                        avatarSrc={
                          avatarByUsername[msg.sender_username] ||
                          resolveStaffAvatar({
                            avatarData: msg.sender_avatar,
                            username: msg.sender_username,
                            role: msg.sender_role,
                          })
                        }
                        showUnreadDivider={msg.id === unreadAnchorId}
                        pinned={pins.includes(msg.id)}
                        deleting={deleteMsg.isPending}
                        onCopy={() => {
                          void navigator.clipboard.writeText(plainTextForCopy(msg.body));
                          showToast("Copied");
                        }}
                        onPin={() => {
                          if (!username) return;
                          setPins(togglePin(username, msg.id));
                        }}
                        onDelete={(mode) => {
                          deleteMsg.mutate(
                            { id: msg.id, mode },
                            {
                              onSuccess: () =>
                                showToast(
                                  mode === "for_everyone"
                                    ? "Deleted for everyone"
                                    : "Deleted for you"
                                ),
                              onError: () => showToast("Could not delete message"),
                            }
                          );
                        }}
                      />
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {showScrollBtn && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-24 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card text-teal-600 shadow-md transition-transform duration-150 hover:scale-105 dark:text-teal-400"
                aria-label="Scroll to latest"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}

            {/* Compact composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="shrink-0 border-t border-border bg-card px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:px-3"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Input
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value)}
                  placeholder="Patient code"
                  className="h-8 min-w-[9rem] flex-1 basis-[9rem] border-slate-200 bg-slate-50 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 sm:max-w-[14rem]"
                />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="h-8 min-w-[8.5rem] flex-1 basis-[8.5rem] rounded-md border border-border bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 dark:bg-slate-800/70 dark:text-slate-100 sm:max-w-[11rem] sm:flex-none"
                  title="Priority tag"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplatesOpen((o) => !o);
                      setEmojiOpen(false);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-slate-50 dark:bg-slate-800/70 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-teal-300 hover:text-slate-900 dark:hover:text-slate-100"
                    title="Quick templates"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Templates</span>
                  </button>
                  {templatesOpen && (
                    <div className="absolute bottom-full right-0 z-30 mb-1 w-64 rounded-xl border border-border bg-card py-1 shadow-lg">
                      {QUICK_TEMPLATES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-xs text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            setBody((b) => (b ? `${b.trim()} ${t}` : t));
                            setTemplatesOpen(false);
                            textareaRef.current?.focus();
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {pendingImages.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-1">
                  {pendingImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative h-10 w-10 overflow-hidden rounded-md border border-border bg-slate-50 dark:bg-slate-800/70"
                    >
                      <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingImages((prev) => prev.filter((p) => p.id !== img.id))
                        }
                        className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
                        aria-label={`Remove ${img.name}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => void onPickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching || send.isPending || pendingImages.length >= 4}
                  className="mb-0.5 shrink-0 rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-40"
                  title="Attach image"
                  aria-label="Attach image"
                >
                  {attaching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>
                <div className="relative mb-0.5 shrink-0" ref={emojiRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmojiOpen((o) => !o);
                      setTemplatesOpen(false);
                    }}
                    className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400"
                    title="Insert emoji"
                    aria-label="Insert emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {emojiOpen && (
                    <div className="absolute bottom-full left-0 z-40 mb-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {EMOJI_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {group.label}
                            </p>
                            <div className="grid grid-cols-8 gap-0.5">
                              {group.emojis.map((emoji) => (
                                <button
                                  key={`${group.label}-${emoji}`}
                                  type="button"
                                  className="rounded-md p-1 text-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                  onClick={() => {
                                    insertEmoji(emoji);
                                    setEmojiOpen(false);
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-slate-50 dark:bg-slate-800/70 focus-within:border-teal-300 focus-within:ring-1 focus-within:ring-teal-100 dark:focus-within:border-teal-600 dark:focus-within:ring-teal-900/50">
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 56)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      const imageFiles: File[] = [];
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                          const f = item.getAsFile();
                          if (f) imageFiles.push(f);
                        }
                      }
                      if (imageFiles.length) {
                        e.preventDefault();
                        const dt = new DataTransfer();
                        imageFiles.forEach((f) => dt.items.add(f));
                        void onPickFiles(dt.files);
                      }
                    }}
                    placeholder={PLACEHOLDER[role]}
                    rows={1}
                    disabled={send.isPending}
                    className="max-h-[56px] min-h-[32px] w-full resize-none bg-transparent px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={
                    (!body.trim() && pendingImages.length === 0) ||
                    send.isPending ||
                    attaching ||
                    body.length > 2000
                  }
                  size="icon"
                  className="mb-0.5 h-8 w-8 shrink-0 rounded-full bg-[#14B8A6] text-white shadow-sm hover:bg-teal-600"
                  aria-label="Send message"
                  title={"Enter to send \u00b7 Shift+Enter for new line"}
                >
                  {send.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
