import type { TeamMessage } from "@/types";
import type { AuthUser } from "@/types/clinical";

export type ConversationFilter = "all" | "broadcast" | "direct";

export type ConversationKind = "broadcast" | "direct";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** Peer username for DMs; null for broadcast */
  peerUsername: string | null;
  title: string;
  role: string;
  subtitle: string;
  lastMessage: string;
  lastAt: string | null;
  messageCount: number;
  patientCode: string;
  podName: string;
  messages: TeamMessage[];
}

const READ_KEY = (user: string) => `teamchat-read:${user}`;
const DRAFT_KEY = (user: string, convId: string) => `teamchat-draft:${user}:${convId}`;
const PIN_KEY = (user: string) => `teamchat-pins:${user}`;

export function conversationIdForMessage(msg: TeamMessage, myUsername: string): string {
  if (msg.is_broadcast) {
    const pod = (msg.pod_name || "").trim();
    return pod ? `broadcast:${pod}` : "broadcast";
  }
  const other =
    msg.sender_username === myUsername ? msg.recipient_username || "unknown" : msg.sender_username;
  return `dm:${other}`;
}

export function broadcastConversationId(podName: string): string {
  const pod = podName.trim();
  return pod ? `broadcast:${pod}` : "broadcast";
}

function shortPodLabel(podName: string): string {
  const name = podName.trim();
  if (!name) return "All NICU";
  return name.replace(/^NICU\s+/i, "") || name;
}

function roleLabel(role: string) {
  if (role === "doctor") return "NICU Doctor";
  if (role === "nurse") return "NICU Nurse";
  if (role === "admin") return "Admin";
  return role || "Staff";
}

function ensureBroadcastThread(
  map: Map<string, Conversation>,
  podName: string,
  opts?: { title?: string; subtitle?: string }
) {
  const id = broadcastConversationId(podName);
  if (map.has(id)) return;
  const isAll = !podName.trim();
  map.set(id, {
    id,
    kind: "broadcast",
    peerUsername: null,
    title: opts?.title || (isAll ? "All NICU" : `${shortPodLabel(podName)} broadcast`),
    role: "broadcast",
    subtitle: opts?.subtitle || (isAll ? "Hospital-wide broadcast" : "Pod broadcast"),
    lastMessage: "",
    lastAt: null,
    messageCount: 0,
    patientCode: "",
    podName: podName.trim(),
    messages: [],
  });
}

export function buildConversations(
  messages: TeamMessage[],
  myUsername: string,
  staff: AuthUser[],
  options?: { myPods?: string[]; isAdmin?: boolean }
): Conversation[] {
  const map = new Map<string, Conversation>();
  const myPods = (options?.myPods || []).map((p) => p.trim()).filter(Boolean);
  const isAdmin = Boolean(options?.isAdmin);

  if (isAdmin) {
    ensureBroadcastThread(map, "", {
      title: "All NICU",
      subtitle: "Hospital-wide broadcast",
    });
  }
  for (const pod of myPods) {
    ensureBroadcastThread(map, pod);
  }
  // Fallback so users with no pods still have a place to land.
  if (!isAdmin && myPods.length === 0) {
    ensureBroadcastThread(map, "", {
      title: "All NICU",
      subtitle: "Hospital-wide broadcast",
    });
  }

  for (const s of staff) {
    if (s.username === myUsername) continue;
    const id = `dm:${s.username}`;
    if (!map.has(id)) {
      const role = s.profile?.role ?? s.role ?? "";
      map.set(id, {
        id,
        kind: "direct",
        peerUsername: s.username,
        title: s.profile?.full_name || s.username,
        role,
        subtitle: roleLabel(role),
        lastMessage: "",
        lastAt: null,
        messageCount: 0,
        patientCode: "",
        podName: s.profile?.ward || s.profile?.wards?.[0] || "",
        messages: [],
      });
    }
  }

  for (const msg of messages) {
    const id = conversationIdForMessage(msg, myUsername);
    let conv = map.get(id);
    if (!conv) {
      if (msg.is_broadcast) {
        ensureBroadcastThread(map, msg.pod_name || "");
        conv = map.get(id)!;
      } else {
        const peer =
          msg.sender_username === myUsername ? msg.recipient_username || "" : msg.sender_username;
        const peerName =
          msg.sender_username === myUsername
            ? msg.recipient_name || peer
            : msg.sender_name || peer;
        const peerRole =
          msg.sender_username === myUsername ? "" : msg.sender_role || "";
        conv = {
          id,
          kind: "direct",
          peerUsername: peer,
          title: peerName || peer,
          role: peerRole,
          subtitle: roleLabel(peerRole) || "Direct message",
          lastMessage: "",
          lastAt: null,
          messageCount: 0,
          patientCode: "",
          podName: msg.pod_name || "",
          messages: [],
        };
        map.set(id, conv);
      }
    }
    conv.messages.push(msg);
  }

  for (const conv of map.values()) {
    conv.messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    conv.messageCount = conv.messages.length;
    const last = conv.messages[conv.messages.length - 1];
    if (last) {
      conv.lastMessage = last.body;
      conv.lastAt = last.created_at;
      conv.patientCode = last.patient_code || conv.patientCode;
      if (conv.kind === "direct") {
        conv.podName = last.pod_name || conv.podName;
      }
      if (conv.kind === "direct" && !conv.role) {
        const peerMsg = [...conv.messages]
          .reverse()
          .find((m) => m.sender_username === conv.peerUsername);
        if (peerMsg) {
          conv.role = peerMsg.sender_role;
          conv.subtitle = roleLabel(peerMsg.sender_role);
          conv.title = peerMsg.sender_name || conv.title;
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.kind === "broadcast" && b.kind !== "broadcast") return -1;
    if (b.kind === "broadcast" && a.kind !== "broadcast") return 1;
    if (a.kind === "broadcast" && b.kind === "broadcast") {
      if (a.id === "broadcast") return -1;
      if (b.id === "broadcast") return 1;
      return a.title.localeCompare(b.title);
    }
    const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
    const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
    return tb - ta;
  });
}

export function filterConversations(
  list: Conversation[],
  filter: ConversationFilter,
  search: string
): Conversation[] {
  const q = search.trim().toLowerCase();
  return list.filter((c) => {
    if (filter === "broadcast" && c.kind !== "broadcast") return false;
    if (filter === "direct" && c.kind !== "direct") return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q) ||
      c.patientCode.toLowerCase().includes(q) ||
      c.podName.toLowerCase().includes(q) ||
      (c.peerUsername || "").toLowerCase().includes(q)
    );
  });
}

export function loadReadMap(username: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY(username)) || "{}");
  } catch {
    return {};
  }
}

export function markConversationRead(username: string, convId: string, atIso: string) {
  const map = loadReadMap(username);
  map[convId] = atIso;
  localStorage.setItem(READ_KEY(username), JSON.stringify(map));
}

export function unreadCount(conv: Conversation, username: string, readMap: Record<string, string>) {
  const since = readMap[conv.id];
  if (!since) {
    return conv.messages.filter((m) => m.sender_username !== username && !m.is_deleted).length;
  }
  const t = new Date(since).getTime();
  return conv.messages.filter(
    (m) =>
      m.sender_username !== username &&
      !m.is_deleted &&
      new Date(m.created_at).getTime() > t
  ).length;
}

export type UnreadChatItem = {
  convId: string;
  title: string;
  count: number;
  lastAt: string | null;
  preview: string;
  peerUsername: string | null;
};

/** Aggregate unread threads for nav badge + “who texted you” list. */
export function summarizeUnreadChat(
  conversations: Conversation[],
  username: string,
  readMap: Record<string, string>
): { total: number; items: UnreadChatItem[] } {
  const items: UnreadChatItem[] = [];
  let total = 0;
  for (const conv of conversations) {
    const count = unreadCount(conv, username, readMap);
    if (count <= 0) continue;
    total += count;
    const unreadMsgs = conv.messages.filter((m) => {
      if (m.sender_username === username || m.is_deleted) return false;
      const since = readMap[conv.id];
      if (!since) return true;
      return new Date(m.created_at).getTime() > new Date(since).getTime();
    });
    const last = unreadMsgs[unreadMsgs.length - 1];
    const who =
      conv.kind === "broadcast"
        ? last?.sender_name
          ? `${last.sender_name} (Everyone)`
          : "Everyone"
        : conv.title;
    items.push({
      convId: conv.id,
      title: who,
      count,
      lastAt: last?.created_at ?? conv.lastAt,
      preview: last?.body?.slice(0, 80) || conv.lastMessage.slice(0, 80),
      peerUsername: conv.peerUsername,
    });
  }
  items.sort((a, b) => {
    const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
    const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
    return tb - ta;
  });
  return { total, items };
}

export function loadDraft(username: string, convId: string) {
  return localStorage.getItem(DRAFT_KEY(username, convId)) || "";
}

export function saveDraft(username: string, convId: string, body: string) {
  if (!body.trim()) localStorage.removeItem(DRAFT_KEY(username, convId));
  else localStorage.setItem(DRAFT_KEY(username, convId), body);
}

export function loadPins(username: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY(username)) || "[]");
  } catch {
    return [];
  }
}

export function togglePin(username: string, messageId: number): number[] {
  const pins = new Set(loadPins(username));
  if (pins.has(messageId)) pins.delete(messageId);
  else pins.add(messageId);
  const next = Array.from(pins);
  localStorage.setItem(PIN_KEY(username), JSON.stringify(next));
  return next;
}

export function formatActivity(iso: string | null): string {
  if (!iso) return "No activity";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** WhatsApp-style last seen / last active line */
export function formatLastSeen(iso: string | null, kind: "broadcast" | "direct"): string {
  if (!iso) return kind === "broadcast" ? "No recent activity" : "last seen a while ago";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return kind === "broadcast" ? "active just now" : "online";
  if (mins < 60) {
    return kind === "broadcast" ? `last active ${mins} min ago` : `last seen ${mins} min ago`;
  }
  if (d.toDateString() === now.toDateString()) {
    return kind === "broadcast" ? `last active today at ${time}` : `last seen today at ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return kind === "broadcast"
      ? `last active yesterday at ${time}`
      : `last seen yesterday at ${time}`;
  }
  const day = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return kind === "broadcast"
    ? `last active ${day} at ${time}`
    : `last seen ${day} at ${time}`;
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function daySeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function initials(name: string) {
  return name
    .replace(/^Dr\.\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export const QUICK_TEMPLATES = [
  "Patient stable.",
  "Please review labs.",
  "Call me when available.",
  "SpO₂ improved — started oxygen weaning.",
  "Urgent: please assess bedside.",
];
