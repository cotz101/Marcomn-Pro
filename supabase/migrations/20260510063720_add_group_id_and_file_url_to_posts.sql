-- Add group_id column (nullable — NULL means Logbook post, non-NULL means Group post)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS group_id text;

-- Add file_url column for PDF/document attachments
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS file_url text;

-- Index for efficient group post filtering
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON public.posts (group_id) WHERE group_id IS NOT NULL;

-- RLS: Allow all authenticated users to read group posts
CREATE POLICY "Anyone can read group posts"
  ON public.posts
  FOR SELECT
  USING (group_id IS NOT NULL AND auth.role() = 'authenticated');

-- RLS: Allow authenticated users to insert their own group posts
CREATE POLICY "Users can insert own group posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (group_id IS NOT NULL AND auth.uid() = user_id);;
