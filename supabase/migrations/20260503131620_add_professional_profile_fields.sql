-- Add missing professional identity columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_position text,
  ADD COLUMN IF NOT EXISTS current_company  text,
  ADD COLUMN IF NOT EXISTS bio             text;

-- Create a dedicated experience table (better for indexing/querying than JSONB)
CREATE TABLE IF NOT EXISTS public.experience (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  company      text NOT NULL,
  location     text,
  start_date   date,
  end_date     date,         -- NULL means "present"
  description  text,
  created_at   timestamp with time zone DEFAULT timezone('utc', now())
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own experience."
  ON public.experience
  USING  ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Anyone can view experience."
  ON public.experience FOR SELECT
  USING ( true );

-- Storage bucket for avatars (public read, owner write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Users can upload their own avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Users can update their own avatar."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );
;
