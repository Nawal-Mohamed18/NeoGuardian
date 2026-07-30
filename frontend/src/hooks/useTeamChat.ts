import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { teamChatApi, getUsername } from "@/lib/api";
import { useClinicalStaff } from "@/hooks/useClinicalStaff";
import { useAuth } from "@/context/AuthContext";
import {
  buildConversations,
  loadReadMap,
  summarizeUnreadChat,
} from "@/lib/teamChatConversations";

export function useTeamChat(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["team-chat"],
    queryFn: teamChatApi.list,
    refetchInterval: 8_000,
    enabled: options?.enabled ?? true,
  });
}

export function useSendTeamMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamChatApi.send,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-chat"] }),
  });
}

export function useDeleteTeamMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: "for_me" | "for_everyone" }) =>
      teamChatApi.deleteMessage(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-chat"] }),
  });
}

export function useMarkTeamChatSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { conversation_id?: string; message_ids?: number[] }) =>
      teamChatApi.markSeen(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-chat"] }),
  });
}

/** Unread chat totals + who texted you (for TopNav badge / dropdown). */
export function useTeamChatUnread(options?: { enabled?: boolean }) {
  const { authed, user } = useAuth();
  const enabled = (options?.enabled ?? true) && authed;
  const { data: messages = [] } = useTeamChat({ enabled });
  const { data: staff = [] } = useClinicalStaff();
  const username = getUsername() || user?.username || "";

  return useMemo(() => {
    if (!username) {
      return { total: 0, items: [] as ReturnType<typeof summarizeUnreadChat>["items"] };
    }
    const conversations = buildConversations(messages, username, staff);
    const readMap = loadReadMap(username);
    return summarizeUnreadChat(conversations, username, readMap);
  }, [messages, staff, username]);
}
