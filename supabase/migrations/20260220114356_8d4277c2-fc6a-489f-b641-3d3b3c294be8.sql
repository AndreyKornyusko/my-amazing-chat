
-- ==========================================
-- 1. ENUM TYPES
-- ==========================================
CREATE TYPE public.conversation_type AS ENUM ('private', 'group');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.message_type AS ENUM ('text', 'photo', 'video', 'file', 'voice');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- ==========================================
-- 2. BASE TABLES
-- ==========================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id),
  CHECK (user_id <> contact_id)
);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL DEFAULT 'private',
  name TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation members
CREATE TABLE public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  type public.message_type NOT NULL DEFAULT 'text',
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  forwarded_from_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message reads
CREATE TABLE public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- User roles (app-level)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- ==========================================
-- 3. INDEXES
-- ==========================================
CREATE INDEX idx_contacts_user ON public.contacts(user_id);
CREATE INDEX idx_contacts_contact ON public.contacts(contact_id);
CREATE INDEX idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_message_reads_msg ON public.message_reads(message_id);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);
CREATE INDEX idx_messages_content_search ON public.messages USING gin(to_tsvector('russian', coalesce(content, '')));

-- ==========================================
-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_owner_or_admin(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ==========================================
-- 5. TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update conversation updated_at when a message is sent
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_updates_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- ==========================================
-- 6. ENABLE RLS
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. RLS POLICIES
-- ==========================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- CONTACTS
CREATE POLICY "Users can view own contacts" ON public.contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid());

CREATE POLICY "Users can add contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND contact_id <> auth.uid());

CREATE POLICY "Users can delete own contacts" ON public.contacts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CONVERSATIONS
CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners/admins can update group conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_owner_or_admin(id, auth.uid()));

-- CONVERSATION MEMBERS
CREATE POLICY "Members can view conversation members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Users can join conversations" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() OR public.is_conversation_owner_or_admin(conversation_id, auth.uid())
  );

CREATE POLICY "Owners/admins can update members" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (public.is_conversation_owner_or_admin(conversation_id, auth.uid()));

CREATE POLICY "Owners/admins can remove members" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (
    public.is_conversation_owner_or_admin(conversation_id, auth.uid())
    OR user_id = auth.uid()
  );

-- MESSAGES
CREATE POLICY "Members can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Senders can edit messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- MESSAGE READS
CREATE POLICY "Members can view read receipts" ON public.message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

CREATE POLICY "Members can mark messages as read" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ==========================================
-- 8. STORAGE BUCKETS
-- ==========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', false);

-- Avatars storage policies
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Chat media storage policies
CREATE POLICY "Members can view chat media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Members can upload chat media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ==========================================
-- 9. ENABLE REALTIME
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
