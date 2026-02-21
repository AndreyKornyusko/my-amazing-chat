-- Fix all restrictive policies to be permissive

-- conversations SELECT
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (is_conversation_member(id, auth.uid()));

-- conversations UPDATE
DROP POLICY IF EXISTS "Owners/admins can update group conversations" ON public.conversations;
CREATE POLICY "Owners/admins can update group conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (is_conversation_owner_or_admin(id, auth.uid()));

-- conversation_members SELECT
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
CREATE POLICY "Members can view conversation members"
ON public.conversation_members FOR SELECT TO authenticated
USING (is_conversation_member(conversation_id, auth.uid()));

-- conversation_members INSERT
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;
CREATE POLICY "Users can join conversations"
ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid()) OR is_conversation_owner_or_admin(conversation_id, auth.uid()));

-- conversation_members UPDATE
DROP POLICY IF EXISTS "Owners/admins can update members" ON public.conversation_members;
CREATE POLICY "Owners/admins can update members"
ON public.conversation_members FOR UPDATE TO authenticated
USING (is_conversation_owner_or_admin(conversation_id, auth.uid()));

-- conversation_members DELETE
DROP POLICY IF EXISTS "Owners/admins can remove members" ON public.conversation_members;
CREATE POLICY "Owners/admins can remove members"
ON public.conversation_members FOR DELETE TO authenticated
USING (is_conversation_owner_or_admin(conversation_id, auth.uid()) OR (user_id = auth.uid()));

-- messages
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages"
ON public.messages FOR SELECT TO authenticated
USING (is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK ((sender_id = auth.uid()) AND is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Senders can edit messages" ON public.messages;
CREATE POLICY "Senders can edit messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Senders can delete messages" ON public.messages;
CREATE POLICY "Senders can delete messages"
ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- message_reads
DROP POLICY IF EXISTS "Members can view read receipts" ON public.message_reads;
CREATE POLICY "Members can view read receipts"
ON public.message_reads FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_reads.message_id AND is_conversation_member(m.conversation_id, auth.uid())));

DROP POLICY IF EXISTS "Members can mark messages as read" ON public.message_reads;
CREATE POLICY "Members can mark messages as read"
ON public.message_reads FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid()) AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_reads.message_id AND is_conversation_member(m.conversation_id, auth.uid())));

-- contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
CREATE POLICY "Users can view own contacts"
ON public.contacts FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR (contact_id = auth.uid()));

DROP POLICY IF EXISTS "Users can add contacts" ON public.contacts;
CREATE POLICY "Users can add contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid()) AND (contact_id <> auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts"
ON public.contacts FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());
