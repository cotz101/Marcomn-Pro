-- Privacy P1: recruitment documents are private objects.  New objects use
-- <authenticated-user-uuid>/<opaque-object-id>.<extension>; legacy objects
-- remain addressable only through the application-authorized download route.

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
where id = 'resumes';

drop policy if exists "Allow authenticated users to upload resumes" on storage.objects;
drop policy if exists "Allow users to update their own resumes" on storage.objects;
drop policy if exists "Resume owners can upload private documents" on storage.objects;
drop policy if exists "Resume owners can read private documents" on storage.objects;
drop policy if exists "Resume owners can update private documents" on storage.objects;
drop policy if exists "Resume owners can delete private documents" on storage.objects;

create policy "Resume owners can upload private documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
);

create policy "Resume owners can read private documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
);

create policy "Resume owners can update private documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
);

create policy "Resume owners can delete private documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
);

-- This pre-existing adjacent upload used the resumes bucket for payment proofs.
-- Move new proofs to their own private bucket so making resumes private does not
-- break the workflow or leave a public-url fallback.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('advance-proofs', 'advance-proofs', false, 10485760, array[
  'application/pdf',
  'image/jpeg',
  'image/png'
]::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Advance proof owners can upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'advance-proofs' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Advance proof owners can read"
on storage.objects for select to authenticated
using (bucket_id = 'advance-proofs' and (storage.foldername(name))[1] = (select auth.uid()::text));
