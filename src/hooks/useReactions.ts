import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: { display_name: string };
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: { user_id: string; display_name: string; avatar_url: string | null }[];
  hasReacted: boolean;
}

export const useReactions = (conversationId: string | null) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["reactions", conversationId],
    queryFn: async () => {
      if (!conversationId) return {};

      // Get all message IDs in conversation
      const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

      if (!msgs || msgs.length === 0) return {};

      const msgIds = msgs.map((m) => m.id);

      // Fetch reactions with batching (supabase limit)
      const allReactions: Reaction[] = [];
      for (let i = 0; i < msgIds.length; i += 500) {
        const batch = msgIds.slice(i, i + 500);
        const { data } = await supabase
          .from("message_reactions")
          .select("*")
          .in("message_id", batch);
        if (data) allReactions.push(...(data as Reaction[]));
      }

      // Fetch profiles for reactors
      const userIds = [...new Set(allReactions.map((r) => r.user_id))];
      const profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);
        profiles?.forEach((p) => { profileMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      }

      // Group by message_id
      const byMessage: Record<string, GroupedReaction[]> = {};
      for (const r of allReactions) {
        if (!byMessage[r.message_id]) byMessage[r.message_id] = [];
        const group = byMessage[r.message_id];
        const existing = group.find((g) => g.emoji === r.emoji);
        const prof = profileMap[r.user_id];
        const userInfo = { user_id: r.user_id, display_name: prof?.display_name || "Unknown", avatar_url: prof?.avatar_url ?? null };
        if (existing) {
          existing.count++;
          existing.users.push(userInfo);
          if (r.user_id === user?.id) existing.hasReacted = true;
        } else {
          group.push({
            emoji: r.emoji,
            count: 1,
            users: [userInfo],
            hasReacted: r.user_id === user?.id,
          });
        }
      }

      return byMessage;
    },
    enabled: !!conversationId && !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`reactions-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["reactions", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, qc]);

  return query.data ?? {};
};

export const useToggleReaction = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if reaction exists
      const { data: existing } = await supabase
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      }
      return conversationId;
    },
    onSuccess: (conversationId) => {
      qc.invalidateQueries({ queryKey: ["reactions", conversationId] });
    },
  });
};
