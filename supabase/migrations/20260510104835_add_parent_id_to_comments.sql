ALTER TABLE public.comments ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Also ensure user_id has a foreign key to profiles if not already there
-- (Checked schema earlier, it was there but let's be sure about the name)
-- Schema had: "comments_user_id_fkey","source":"public.comments.user_id","target":"public.profiles.id"
;
