-- Fix SELECT policy to also allow the creator to see the conversation
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (is_conversation_member(id, auth.uid()) OR created_by = auth.uid());
