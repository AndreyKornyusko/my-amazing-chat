
-- Security definer function to check if user can view a profile
CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _viewer_id = _profile_id  -- can always view own profile
    OR EXISTS (
      -- shares a conversation
      SELECT 1 FROM public.conversation_members cm1
      JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
      WHERE cm1.user_id = _viewer_id AND cm2.user_id = _profile_id
    )
    OR EXISTS (
      -- is a contact
      SELECT 1 FROM public.contacts
      WHERE (user_id = _viewer_id AND contact_id = _profile_id)
         OR (user_id = _profile_id AND contact_id = _viewer_id)
    );
$$;

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restricted policy
CREATE POLICY "Users can view accessible profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(auth.uid(), id));
