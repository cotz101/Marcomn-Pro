-- DRAFT ONLY: Phase 1.3B migration 3/6. Review Storage schema compatibility first.
begin;

do $$
declare
  v_expected_mimes text[] := array[
    'image/jpeg','image/png','image/webp','image/gif','application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'
  ];
  v_bucket storage.buckets%rowtype;
begin
  select * into v_bucket from storage.buckets where id = 'group-message-attachments' for update;
  if found then
    if v_bucket.name <> 'group-message-attachments' or v_bucket.public
      or v_bucket.file_size_limit is distinct from 26214400
      or v_bucket.allowed_mime_types is distinct from v_expected_mimes
    then raise exception 'conflicting group-message-attachments bucket configuration'; end if;
  else
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values ('group-message-attachments','group-message-attachments',false,26214400,v_expected_mimes);
  end if;
end $$;

create function group_attachments_private.object_authorized(p_user_id uuid, p_object_name text, p_write boolean)
returns boolean language sql stable security definer set search_path = pg_catalog, public, storage as $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and exists (
    select 1 from public.group_message_attachments a
    join public.group_thread_messages m on m.id = a.message_id and not m.is_deleted
    join public.group_threads t on t.id = a.thread_id and t.group_id = a.group_id
      and not t.is_deleted and not t.is_archived
    where a.storage_bucket = 'group-message-attachments' and a.storage_path = p_object_name
      and a.deleted_at is null
      and split_part(p_object_name,'/',1) = a.group_id::text
      and split_part(p_object_name,'/',2) = a.thread_id::text
      and split_part(p_object_name,'/',3) = a.uploader_id::text
      and split_part(p_object_name,'/',4) = a.id::text
      and array_length(string_to_array(p_object_name,'/'),1) = 5
      and group_attachments_private.is_accepted_member(p_user_id, a.group_id)
      and (
        (not p_write and (m.delivery_status = 'published'
          or (m.delivery_status = 'draft' and a.uploader_id = p_user_id and a.status = 'pending')))
        or (p_write and m.delivery_status = 'draft' and a.uploader_id = p_user_id
          and m.user_id = p_user_id and a.status = 'pending')
      )
  )
$$;
revoke all on function group_attachments_private.object_authorized(uuid,text,boolean) from public, anon;
grant execute on function group_attachments_private.object_authorized(uuid,text,boolean) to authenticated, service_role;

create policy group_message_attachment_objects_read on storage.objects
for select to authenticated using (bucket_id = 'group-message-attachments'
  and group_attachments_private.object_authorized((select auth.uid()), name, false));
create policy group_message_attachment_objects_insert on storage.objects
for insert to authenticated with check (bucket_id = 'group-message-attachments'
  and group_attachments_private.object_authorized((select auth.uid()), name, true));
-- No UPDATE policy: clients cannot upsert/overwrite. No DELETE policy: cleanup uses service role.

commit;
