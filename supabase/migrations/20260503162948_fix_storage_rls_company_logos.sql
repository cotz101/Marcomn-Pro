-- Policy to allow public read access to company-logos bucket
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');

-- Policy to allow authenticated users to upload to company-logos bucket
CREATE POLICY "Auth Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

-- Policy to allow authenticated users to update their uploads in company-logos bucket
CREATE POLICY "Auth Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

-- Also adding the requested policies for the avatars bucket with the specified prefix
CREATE POLICY "Public Read Access for Company Logos in Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND name LIKE 'company-logos/%');
CREATE POLICY "Auth Upload Access for Company Logos in Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND name LIKE 'company-logos/%' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update Access for Company Logos in Avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND name LIKE 'company-logos/%' AND auth.role() = 'authenticated');
;
