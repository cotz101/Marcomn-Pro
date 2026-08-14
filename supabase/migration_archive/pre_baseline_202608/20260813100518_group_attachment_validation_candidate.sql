-- Phase 1.3C: narrowly expose a hidden draft attachment to the trusted validator.
begin;

alter table public.group_message_attachments
  drop constraint group_message_attachments_mime;
alter table public.group_message_attachments
  add constraint group_message_attachments_mime check (
    attachment_type not in ('image','document') or mime_type in (
      'image/jpeg','image/png','image/webp','application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    )
  );

-- Phase 1.3B generates immutable paths inside this function. Extend only its legacy Office
-- extension mapping; fail closed if the reviewed predecessor definition is not present.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.reserve_group_thread_message(uuid,uuid,text,jsonb)'::regprocedure)
    into v_definition;
  v_updated := replace(
    v_definition,
    $$when 'application/pdf' then 'pdf'$$,
    $$when 'application/pdf' then 'pdf'
        when 'application/msword' then 'doc'
        when 'application/vnd.ms-excel' then 'xls'
        when 'application/vnd.ms-powerpoint' then 'ppt'$$
  );
  if v_updated is not distinct from v_definition then
    raise exception 'reviewed reservation MIME mapping was not found';
  end if;
  execute v_updated;
end
$migration$;

alter table public.group_message_attachments
  add constraint group_message_attachments_phase_13c_allowlist_check check (
    (attachment_type = 'image' and (
      (mime_type = 'image/jpeg' and original_filename ~* '\.jpe?g$')
      or (mime_type = 'image/png' and original_filename ~* '\.png$')
      or (mime_type = 'image/webp' and original_filename ~* '\.webp$')
    ))
    or (attachment_type = 'document' and (
      (mime_type = 'application/pdf' and original_filename ~* '\.pdf$')
      or (mime_type = 'application/msword' and original_filename ~* '\.doc$')
      or (mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and original_filename ~* '\.docx$')
      or (mime_type = 'application/vnd.ms-excel' and original_filename ~* '\.xls$')
      or (mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and original_filename ~* '\.xlsx$')
      or (mime_type = 'application/vnd.ms-powerpoint' and original_filename ~* '\.ppt$')
      or (mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' and original_filename ~* '\.pptx$')
      or (mime_type = 'text/plain' and original_filename ~* '\.txt$')
    ))
    or (attachment_type in ('youtube','vimeo') and mime_type is null)
  );

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]::text[]
where id = 'group-message-attachments';

-- Supports a future authorized Group Shared files query. Existing attachment RLS already
-- requires an active member and a published, non-deleted parent message.
create index group_message_attachments_shared_files_idx
  on public.group_message_attachments(group_id, created_at desc)
  where status = 'ready' and deleted_at is null;

create function public.get_group_attachment_validation_candidate(
  p_attachment_id uuid,
  p_requesting_user_id uuid
) returns table (
  attachment_id uuid,
  message_id uuid,
  attachment_type public.group_message_attachment_type,
  storage_bucket text,
  storage_path text,
  declared_mime_type text,
  declared_byte_size bigint,
  external_url text
) language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_attachment_id is null or p_requesting_user_id is null then
    raise exception 'validation candidate unavailable' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.message_id,
    a.attachment_type,
    a.storage_bucket,
    a.storage_path,
    a.mime_type,
    a.byte_size,
    a.external_url
  from public.group_message_attachments as a
  join public.group_thread_messages as m
    on m.id = a.message_id
    and m.thread_id = a.thread_id
  join public.group_threads as t
    on t.id = a.thread_id
    and t.group_id = a.group_id
  join public.groups as g
    on g.id = a.group_id
  where a.id = p_attachment_id
    and a.deleted_at is null
    and a.status = 'pending'::public.group_message_attachment_status
    and (
      (a.attachment_type = 'image' and a.mime_type in ('image/jpeg','image/png','image/webp'))
      or (a.attachment_type = 'document' and a.mime_type in (
        'application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
      ))
      or a.attachment_type in ('youtube','vimeo')
    )
    and a.uploader_id = p_requesting_user_id
    and m.user_id = p_requesting_user_id
    and m.delivery_status = 'draft'
    and not m.is_deleted
    and not t.is_deleted
    and not t.is_archived
    and (
      g.owner_id = p_requesting_user_id
      or exists (
        select 1
        from public.group_members as gm
        where gm.group_id = g.id
          and gm.user_id = p_requesting_user_id
          and gm.status = 'member'
      )
    );

  if not found then
    raise exception 'validation candidate unavailable' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.get_group_attachment_validation_candidate(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_attachment_validation_candidate(uuid, uuid)
  to service_role;

commit;
