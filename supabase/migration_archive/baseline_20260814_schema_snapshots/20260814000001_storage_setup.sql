
-- Create buckets if they do not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, null, null),
  ('company-logos', 'company-logos', true, null, null),
  ('group-media', 'group-media', true, null, null),
  ('group-banners', 'group-banners', true, null, null),
  ('group-attachments', 'group-attachments', true, null, null),
  ('mblog', 'mblog', true, null, null),
  ('resumes', 'resumes', true, null, null),
  ('logbook-media', 'logbook-media', true, null, null),
  ('platform-assets', 'platform-assets', true, null, null),
  ('group-message-attachments', 'group-message-attachments', false, 26214400, ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- Drop existing policies to make it rerun-safe

DROP POLICY IF EXISTS "Admin delete platform-assets" ON "storage"."objects";
CREATE POLICY "Admin delete platform-assets" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'platform-assets'::"text") AND (EXISTS ( SELECT 1
FROM "public"."profiles"
WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."global_role")::"text" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'brand_manager'::"text"])))))));

DROP POLICY IF EXISTS "Admin insert platform-assets" ON "storage"."objects";
CREATE POLICY "Admin insert platform-assets" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'platform-assets'::"text") AND (EXISTS ( SELECT 1
FROM "public"."profiles"
WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."global_role")::"text" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'brand_manager'::"text"])))))));

DROP POLICY IF EXISTS "Admin update platform-assets" ON "storage"."objects";
CREATE POLICY "Admin update platform-assets" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'platform-assets'::"text") AND (EXISTS ( SELECT 1
FROM "public"."profiles"
WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."global_role")::"text" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'brand_manager'::"text"]))))))) WITH CHECK ((("bucket_id" = 'platform-assets'::"text") AND (EXISTS ( SELECT 1
FROM "public"."profiles"
WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."global_role")::"text" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'brand_manager'::"text"])))))));

DROP POLICY IF EXISTS "Allow authenticated uploads 19s18jd_0" ON "storage"."objects";
CREATE POLICY "Allow authenticated uploads 19s18jd_0" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'group-banners'::"text"));

DROP POLICY IF EXISTS "Allow authenticated uploads 19s18jd_1" ON "storage"."objects";
CREATE POLICY "Allow authenticated uploads 19s18jd_1" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'group-banners'::"text"));

DROP POLICY IF EXISTS "Allow authenticated users to upload resumes" ON "storage"."objects";
CREATE POLICY "Allow authenticated users to upload resumes" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'resumes'::"text"));

DROP POLICY IF EXISTS "Allow users to update their own resumes" ON "storage"."objects";
CREATE POLICY "Allow users to update their own resumes" ON "storage"."objects" FOR UPDATE TO "authenticated" WITH CHECK ((("bucket_id" = 'resumes'::"text") AND ("auth"."uid"() = "owner")));

DROP POLICY IF EXISTS "Auth Update Access" ON "storage"."objects";
CREATE POLICY "Auth Update Access" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'company-logos'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Auth Update Access for Company Logos in Avatars" ON "storage"."objects";
CREATE POLICY "Auth Update Access for Company Logos in Avatars" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'avatars'::"text") AND ("name" ~~ 'company-logos/%'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Auth Upload Access" ON "storage"."objects";
CREATE POLICY "Auth Upload Access" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'company-logos'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Auth Upload Access for Company Logos in Avatars" ON "storage"."objects";
CREATE POLICY "Auth Upload Access for Company Logos in Avatars" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ("name" ~~ 'company-logos/%'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Authenticated Upload" ON "storage"."objects";
CREATE POLICY "Authenticated Upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'mblog'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Authenticated Users Upload a90nyc_0" ON "storage"."objects";
CREATE POLICY "Authenticated Users Upload a90nyc_0" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "Authenticated Users Upload a90nyc_1" ON "storage"."objects";
CREATE POLICY "Authenticated Users Upload a90nyc_1" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "Authenticated Users can upload" ON "storage"."objects";
CREATE POLICY "Authenticated Users can upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'group-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));

DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON "storage"."objects";
CREATE POLICY "Avatar images are publicly accessible." ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));

DROP POLICY IF EXISTS "Owner Update and Delete" ON "storage"."objects";
CREATE POLICY "Owner Update and Delete" ON "storage"."objects" USING ((("bucket_id" = 'mblog'::"text") AND ("auth"."uid"() = "owner")));

DROP POLICY IF EXISTS "Public Access" ON "storage"."objects";
CREATE POLICY "Public Access" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'mblog'::"text"));

DROP POLICY IF EXISTS "Public Access a90nyc_0" ON "storage"."objects";
CREATE POLICY "Public Access a90nyc_0" ON "storage"."objects" FOR SELECT TO "anon" USING (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "Public Read Access" ON "storage"."objects";
CREATE POLICY "Public Read Access" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'company-logos'::"text"));

DROP POLICY IF EXISTS "Public Read Access for Company Logos in Avatars" ON "storage"."objects";
CREATE POLICY "Public Read Access for Company Logos in Avatars" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'avatars'::"text") AND ("name" ~~ 'company-logos/%'::"text")));

DROP POLICY IF EXISTS "Public read platform-assets" ON "storage"."objects";
CREATE POLICY "Public read platform-assets" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'platform-assets'::"text"));

DROP POLICY IF EXISTS "User can Update own media a90nyc_0" ON "storage"."objects";
CREATE POLICY "User can Update own media a90nyc_0" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "User can Update own media a90nyc_1" ON "storage"."objects";
CREATE POLICY "User can Update own media a90nyc_1" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "User can Update own media a90nyc_2" ON "storage"."objects";
CREATE POLICY "User can Update own media a90nyc_2" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "User can Update own media a90nyc_3" ON "storage"."objects";
CREATE POLICY "User can Update own media a90nyc_3" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'logbook-media'::"text"));

DROP POLICY IF EXISTS "Users can delete their own media" ON "storage"."objects";
CREATE POLICY "Users can delete their own media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'group-media'::"text") AND ("auth"."uid"() = "owner")));

DROP POLICY IF EXISTS "Users can update their own avatar." ON "storage"."objects";
CREATE POLICY "Users can update their own avatar." ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'avatars'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

DROP POLICY IF EXISTS "Users can update their own media" ON "storage"."objects";
CREATE POLICY "Users can update their own media" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'group-media'::"text") AND ("auth"."uid"() = "owner")));

DROP POLICY IF EXISTS "Users can upload their own avatar." ON "storage"."objects";
CREATE POLICY "Users can upload their own avatar." ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

DROP POLICY IF EXISTS "group-attachments-policy 18792si_0" ON "storage"."objects";
CREATE POLICY "group-attachments-policy 18792si_0" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'group-attachments'::"text"));

DROP POLICY IF EXISTS "group-attachments-policy 18792si_1" ON "storage"."objects";
CREATE POLICY "group-attachments-policy 18792si_1" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'group-attachments'::"text"));

DROP POLICY IF EXISTS "group_message_attachment_objects_insert" ON "storage"."objects";
CREATE POLICY "group_message_attachment_objects_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'group-message-attachments'::"text") AND "group_attachments_private"."object_authorized"(( SELECT "auth"."uid"() AS "uid"), "name", true)));

DROP POLICY IF EXISTS "group_message_attachment_objects_read" ON "storage"."objects";
CREATE POLICY "group_message_attachment_objects_read" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'group-message-attachments'::"text") AND "group_attachments_private"."object_authorized"(( SELECT "auth"."uid"() AS "uid"), "name", false)));