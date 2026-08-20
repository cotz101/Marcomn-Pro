-- Create group-media bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('group-media', 'group-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for group-media
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'group-media');
CREATE POLICY "Authenticated Users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'group-media' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own media" ON storage.objects FOR UPDATE USING (bucket_id = 'group-media' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own media" ON storage.objects FOR DELETE USING (bucket_id = 'group-media' AND auth.uid() = owner);

-- Update posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS file_urls text[] DEFAULT '{}';
;
