import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Contact {
  id: string;
  contact_id: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_online: boolean | null;
    last_seen: string | null;
  };
}

export const useContacts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_id")
        .eq("user_id", user.id);
      if (error) throw error;

      const contacts: Contact[] = [];
      for (const c of data ?? []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, is_online, last_seen")
          .eq("id", c.contact_id)
          .single();
        if (profile) contacts.push({ id: c.id, contact_id: c.contact_id, profile });
      }
      return contacts;
    },
    enabled: !!user,
  });
};

export const useAddContact = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("contacts").insert({ user_id: user.id, contact_id: contactId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
};

export const useRemoveContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactRowId: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", contactRowId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
};

export const useSearchUsers = (query: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["searchUsers", query],
    queryFn: async () => {
      if (!user || query.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_online")
        .neq("id", user.id)
        .or(`display_name.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && query.length >= 2,
  });
};
