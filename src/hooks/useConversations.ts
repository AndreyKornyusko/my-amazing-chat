import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface ConversationWithDetails {
  id: string;
  type: "private" | "group";
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  members: { user_id: string; role: string; profile: { id: string; display_name: string; avatar_url: string | null; is_online: boolean | null; last_seen: string | null } }[];
  last_message?: { content: string | null; type: string; created_at: string; sender_id: string } | null;
  unread_count: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: convMembers, error: cmErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (cmErr) throw cmErr;

      const convIds = convMembers?.map((cm) => cm.conversation_id) ?? [];
      if (convIds.length === 0) return [];

      const { data: conversations, error: cErr } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("updated_at", { ascending: false });
      if (cErr) throw cErr;

      const result: ConversationWithDetails[] = [];

      for (const conv of conversations ?? []) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id, role")
          .eq("conversation_id", conv.id);

        const memberProfiles = [];
        for (const m of members ?? []) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, is_online, last_seen")
            .eq("id", m.user_id)
            .single();
          memberProfiles.push({ user_id: m.user_id, role: m.role, profile: profile! });
        }

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, type, created_at, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread
        const { data: allMsgs } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id);

        const msgIds = allMsgs?.map((m) => m.id) ?? [];
        let unreadCount = msgIds.length;
        if (msgIds.length > 0) {
          const { data: reads } = await supabase
            .from("message_reads")
            .select("message_id")
            .eq("user_id", user.id)
            .in("message_id", msgIds);
          unreadCount = msgIds.length - (reads?.length ?? 0);
        }

        result.push({
          id: conv.id,
          type: conv.type,
          name: conv.name,
          avatar_url: conv.avatar_url,
          updated_at: conv.updated_at,
          members: memberProfiles,
          last_message: lastMsg,
          unread_count: unreadCount,
        });
      }

      return result;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return query;
};

export const useCreatePrivateConversation = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if private conversation already exists
      const { data: myConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      const { data: theirConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", contactId);

      const myIds = new Set(myConvs?.map((c) => c.conversation_id));
      const sharedIds = theirConvs?.filter((c) => myIds.has(c.conversation_id)).map((c) => c.conversation_id) ?? [];

      if (sharedIds.length > 0) {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .in("id", sharedIds)
          .eq("type", "private")
          .limit(1)
          .maybeSingle();
        if (existing) return existing.id;
      }

      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ type: "private", created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      // Insert owner first so RLS check passes for the second insert
      const { error: ownerErr } = await supabase.from("conversation_members").insert({ conversation_id: conv.id, user_id: user.id, role: "owner" });
      if (ownerErr) throw ownerErr;
      const { error: memberErr } = await supabase.from("conversation_members").insert({ conversation_id: conv.id, user_id: contactId, role: "member" });
      if (memberErr) throw memberErr;

      return conv.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

export const useCreateGroupConversation = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ type: "group", name, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      // Insert owner first so RLS check passes for subsequent inserts
      const { error: ownerErr } = await supabase.from("conversation_members").insert({ conversation_id: conv.id, user_id: user.id, role: "owner" as const });
      if (ownerErr) throw ownerErr;

      if (memberIds.length > 0) {
        const otherMembers = memberIds.map((id) => ({ conversation_id: conv.id, user_id: id, role: "member" as const }));
        const { error: membersErr } = await supabase.from("conversation_members").insert(otherMembers);
        if (membersErr) throw membersErr;
      }
      return conv.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};
