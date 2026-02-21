-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
