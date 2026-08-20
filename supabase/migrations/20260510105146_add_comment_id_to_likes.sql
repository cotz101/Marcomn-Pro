ALTER TABLE public.likes ADD COLUMN comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.likes ALTER COLUMN post_id DROP NOT NULL;
COMMENT ON COLUMN public.likes.comment_id IS 'Reference to the comment being liked, if applicable.';
;
