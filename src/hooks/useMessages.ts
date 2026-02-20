import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";

export type Message = Tables<"messages"> & {
  sender_profile?: { display_name: string; avatar_url: string | null };
  reply_to?: { content: string | null; sender_id: string } | null;
  read_by?: string[];
};

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId || !user) return [];

      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;

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

        const { data: reads } = await supabase
          .from("message_reads")
          .select("user_id")
          .eq("message_id", msg.id);

        enriched.push({
          ...msg,
          sender_profile: profile ?? undefined,
          reply_to: replyTo,
          read_by: reads?.map((r) => r.user_id) ?? [],
        });
      }

      return enriched;
    },
    enabled: !!conversationId && !!user,
  });

  // Realtime
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

  return query;
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
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("messages").insert({
        ...msg,
        sender_id: user.id,
        type: msg.type || "text",
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["messages", vars.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
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
      }
    },
  });
};
