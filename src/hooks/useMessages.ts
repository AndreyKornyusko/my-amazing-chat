import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

const PAGE_SIZE = 30;

export type Message = Tables<"messages"> & {
  sender_profile?: { display_name: string; avatar_url: string | null };
  reply_to?: { content: string | null; sender_id: string } | null;
  forwarded_from_profile?: { display_name: string; sender_id: string } | null;
  read_by?: string[];
  _optimistic?: boolean;
  _status?: "sending" | "failed";
  _errorMsg?: string;
  _tempId?: string;
};

/**
 * Paginated messages hook using useInfiniteQuery.
 * Pages are fetched newest-first (DESC) and reversed for display (oldest-first).
 * "Next page" = older messages (scroll up to load more).
 */
export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!conversationId || !user) return [];

      const from = pageParam;
      const to = pageParam + PAGE_SIZE - 1;

      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      // Enrich each message with profile, reply_to, and read_by
      const enriched: Message[] = [];
      for (const msg of msgs ?? []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", msg.sender_id)
          .single();

        let replyTo = null;
        if (msg.reply_to_id) {
          const { data: reply } = await supabase
            .from("messages")
            .select("content, sender_id")
            .eq("id", msg.reply_to_id)
            .single();
          replyTo = reply;
        }

        let forwardedFromProfile = null;
        if (msg.forwarded_from_id) {
          const { data: fwdMsg } = await supabase
            .from("messages")
            .select("sender_id")
            .eq("id", msg.forwarded_from_id)
            .single();
          if (fwdMsg) {
            const { data: fwdProfile } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", fwdMsg.sender_id)
              .single();
            forwardedFromProfile = fwdProfile ? { ...fwdProfile, sender_id: fwdMsg.sender_id } : null;
          }
        }

        const { data: reads } = await supabase
          .from("message_reads")
          .select("user_id")
          .eq("message_id", msg.id);

        enriched.push({
          ...msg,
          sender_profile: profile ?? undefined,
          reply_to: replyTo,
          forwarded_from_profile: forwardedFromProfile,
          read_by: reads?.map((r) => r.user_id) ?? [],
        });
      }

      return enriched;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If last page returned a full page, there may be more
      if (lastPage.length === PAGE_SIZE) {
        return allPages.length * PAGE_SIZE;
      }
      return undefined;
    },
    enabled: !!conversationId && !!user,
  });

  // Realtime subscription — invalidate on changes
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => {
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  // Flatten pages into a single array, reversed so oldest messages come first
  const allMessages = useMemo(() => {
    if (!query.data) return [];
    // Each page is newest-first; reverse each page, then reverse page order
    const flat: Message[] = [];
    const pages = [...query.data.pages].reverse();
    for (const page of pages) {
      flat.push(...[...page].reverse());
    }
    return flat;
  }, [query.data]);

  return {
    messages: allMessages,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
};

/**
 * Returns a Set of message IDs that are unread for the current user.
 * Only considers messages from other users.
 */
export const useUnreadMessageIds = (conversationId: string | null) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["unread-ids", conversationId, user?.id],
    queryFn: async () => {
      if (!conversationId || !user) return new Set<string>();

      // Get all messages in this conversation from other users
      const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id);

      if (!msgs || msgs.length === 0) return new Set<string>();

      // Get all read receipts for the current user in this conversation
      const msgIds = msgs.map((m) => m.id);
      const { data: reads } = await supabase
        .from("message_reads")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", msgIds);

      const readSet = new Set((reads ?? []).map((r) => r.message_id));
      return new Set(msgs.filter((m) => !readSet.has(m.id)).map((m) => m.id));
    },
    enabled: !!conversationId && !!user,
  });

  return query.data ?? new Set<string>();
};

export const useSendMessage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (msg: {
      conversation_id: string;
      content?: string;
      type?: "text" | "photo" | "video" | "file" | "voice";
      file_url?: string;
      file_name?: string;
      file_size?: number;
      reply_to_id?: string;
      forwarded_from_id?: string;
      _tempId?: string; // internal, not sent to DB
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { _tempId, ...dbMsg } = msg;
      const { data, error } = await supabase.from("messages").insert({
        ...dbMsg,
        sender_id: user.id,
        type: dbMsg.type || "text",
      }).select("*").single();
      if (error) throw error;
      return { data, _tempId };
    },
    onMutate: async (msg) => {
      if (!user) return;
      const queryKey = ["messages", msg.conversation_id];
      await qc.cancelQueries({ queryKey });

      const previous = qc.getQueryData(queryKey);

      const optimisticMessage: Message = {
        id: msg._tempId || `temp-${crypto.randomUUID()}`,
        conversation_id: msg.conversation_id,
        sender_id: user.id,
        content: msg.content ?? null,
        type: (msg.type || "text") as any,
        file_url: msg.file_url ?? null,
        file_name: msg.file_name ?? null,
        file_size: msg.file_size ?? null,
        reply_to_id: msg.reply_to_id ?? null,
        forwarded_from_id: msg.forwarded_from_id ?? null,
        is_edited: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_profile: { display_name: user.user_metadata?.display_name || "You", avatar_url: null },
        read_by: [],
        reply_to: null,
        _optimistic: true as any,
        _status: "sending" as any,
      };

      // Add to the last page of infinite query
      qc.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        const newPages = [...old.pages];
        // Messages in pages are newest-first, add at beginning of first page
        newPages[0] = [optimisticMessage, ...(newPages[0] || [])];
        return { ...old, pages: newPages };
      });

      return { previous, tempId: optimisticMessage.id };
    },
    onSuccess: (result, vars) => {
      const queryKey = ["messages", vars.conversation_id];
      // Replace optimistic message with real one
      qc.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        const realMsg: Message = {
          ...result.data,
          sender_profile: { display_name: user!.user_metadata?.display_name || "You", avatar_url: null },
          read_by: [],
          reply_to: null,
        };
        return {
          ...old,
          pages: old.pages.map((page: Message[]) =>
            page.map((m: any) => (m.id === result._tempId || m.id === vars._tempId) ? realMsg : m)
          ),
        };
      });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (_err, vars, context) => {
      const queryKey = ["messages", vars.conversation_id];
      // Mark the optimistic message as failed instead of rolling back
      qc.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: Message[]) =>
            page.map((m: any) => (m.id === context?.tempId || m.id === vars._tempId) 
              ? { ...m, _status: "failed", _errorMsg: _err instanceof Error ? _err.message : "Send failed" }
              : m
            )
          ),
        };
      });
    },
  });
};

export const useEditMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content, conversationId }: { id: string; content: string; conversationId: string }) => {
      const { error } = await supabase.from("messages").update({ content, is_edited: true }).eq("id", id);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
};

export const useDeleteMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conversationId }: { id: string; conversationId: string }) => {
      const { error } = await supabase.from("messages").update({ is_deleted: true, content: null }).eq("id", id);
      if (error) throw error;
      return conversationId;
    },
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
};

export const useMarkAsRead = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageIds, conversationId }: { messageIds: string[]; conversationId: string }) => {
      if (!user || messageIds.length === 0) return;
      const inserts = messageIds.map((message_id) => ({ message_id, user_id: user.id }));
      await supabase.from("message_reads").upsert(inserts, { onConflict: "message_id,user_id" });
      return conversationId;
    },
    onSuccess: (conversationId) => {
      if (conversationId) {
        qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["unread-ids", conversationId] });
      }
    },
  });
};
