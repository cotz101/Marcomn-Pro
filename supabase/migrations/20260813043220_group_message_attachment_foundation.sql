-- DRAFT ONLY: Phase 1.3B migration 1/6. Generate final CLI timestamps before application.
begin;

alter table public.group_thread_messages
  add column delivery_status text not null default 'published',
  add column reservation_request jsonb,
  add constraint group_thread_messages_delivery_status_check
    check (delivery_status in ('draft','published','cancelled')),
  add constraint group_thread_messages_content_length_check
    check (char_length(content) <= 10000),
  add constraint group_thread_messages_reservation_request_check check (
    (delivery_status = 'draft' and reservation_request is not null
      and jsonb_typeof(reservation_request) = 'object'
      and octet_length(reservation_request::text) <= 32768)
    or delivery_status in ('published','cancelled')
  );

create index group_thread_messages_published_thread_idx
  on public.group_thread_messages(thread_id, created_at)
  where delivery_status = 'published' and not is_deleted;
create index group_thread_messages_stale_draft_idx
  on public.group_thread_messages(created_at)
  where delivery_status in ('draft','cancelled');

create function public.enforce_group_thread_message_delivery_transition()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.delivery_status is null or new.delivery_status not in ('draft','published','cancelled') then
    raise exception 'invalid message delivery status';
  end if;
  if tg_op = 'INSERT' then
    if (new.delivery_status = 'draft' and new.reservation_request is not null)
      or (new.delivery_status = 'published' and new.reservation_request is null)
    then return new; end if;
    raise exception 'invalid initial message delivery state';
  end if;
  if old.delivery_status is not distinct from new.delivery_status then
    return new;
  end if;
  if old.delivery_status = 'draft' and new.delivery_status in ('published','cancelled') then
    return new;
  end if;
  raise exception 'invalid message delivery transition: % -> %',old.delivery_status,new.delivery_status;
end $$;
revoke all on function public.enforce_group_thread_message_delivery_transition() from public;
create trigger group_thread_messages_delivery_transition
before insert or update of delivery_status on public.group_thread_messages
for each row execute function public.enforce_group_thread_message_delivery_transition();

create type public.group_message_attachment_type as enum
  ('image', 'document', 'external_link', 'youtube', 'vimeo');
create type public.group_message_attachment_status as enum
  ('pending', 'ready', 'failed', 'quarantined');

create table public.group_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_thread_messages(id) on delete cascade,
  thread_id uuid not null references public.group_threads(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete restrict,
  attachment_type public.group_message_attachment_type not null,
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  byte_size bigint,
  external_url text,
  title text,
  preview_metadata jsonb not null default '{}'::jsonb,
  actual_mime_type text,
  actual_byte_size bigint,
  content_sha256 text,
  inspection_metadata jsonb,
  inspected_at timestamptz,
  inspected_by text,
  sort_order smallint not null,
  status public.group_message_attachment_status not null default 'pending',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint group_message_attachments_sort_order check (sort_order between 0 and 4),
  constraint group_message_attachments_size check (byte_size is null or byte_size between 1 and 26214400),
  constraint group_message_attachments_preview_object check (
    jsonb_typeof(preview_metadata)='object'
    and jsonb_array_length(jsonb_path_query_array(preview_metadata,'$.**'))<=100
  ),
  constraint group_message_attachments_text_limits check (
    (original_filename is null or char_length(original_filename) between 1 and 255)
    and (title is null or char_length(title) <= 300)
    and (external_url is null or char_length(external_url) <= 2048)
    and (storage_path is null or char_length(storage_path) <= 1024)
    and octet_length(preview_metadata::text) <= 16384
  ),
  constraint group_message_attachments_inspection_shape check (
    inspection_metadata is null or
    (jsonb_typeof(inspection_metadata)='object' and octet_length(inspection_metadata::text)<=16384
      and jsonb_array_length(jsonb_path_query_array(inspection_metadata,'$.**'))<=100)
  ),
  constraint group_message_attachments_inspector_length check
    (inspected_by is null or char_length(inspected_by) between 1 and 200),
  constraint group_message_attachments_actual_size check
    (actual_byte_size is null or actual_byte_size between 1 and 26214400),
  constraint group_message_attachments_sha256 check
    (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint group_message_attachments_ready_evidence check (
    status <> 'ready' or (
      inspection_metadata is not null and inspected_at is not null and inspected_by is not null
      and char_length(inspected_by) between 1 and 200
      and inspection_metadata->>'safe' is not null
      and inspection_metadata->>'safe' = 'true'
      and (
        (attachment_type in ('image','document')
          and actual_mime_type is not null and actual_byte_size is not null
          and content_sha256 is not null
          and actual_mime_type = mime_type and actual_byte_size = byte_size
          and inspection_metadata->>'magic_bytes_valid' is not null
          and inspection_metadata->>'magic_bytes_valid' = 'true'
          and (mime_type not like 'application/vnd.openxmlformats-officedocument.%'
            or (inspection_metadata->>'office_container_valid' is not null
              and inspection_metadata->>'office_container_valid' = 'true')))
        or
        (attachment_type in ('external_link','youtube','vimeo')
          and actual_mime_type is null and actual_byte_size is null and content_sha256 is null
          and inspection_metadata->>'canonical_url' is not null
          and inspection_metadata->>'canonical_url' = external_url
          and inspection_metadata->>'ssrf_safe' is not null
          and inspection_metadata->>'ssrf_safe' = 'true')
      )
    )
  ),
  constraint group_message_attachments_delete_pair check
    ((deleted_at is null and deleted_by is null) or deleted_at is not null),
  constraint group_message_attachments_shape check (
    (attachment_type in ('image', 'document')
      and storage_bucket = 'group-message-attachments'
      and nullif(storage_path, '') is not null
      and nullif(original_filename, '') is not null
      and nullif(mime_type, '') is not null
      and byte_size is not null
      and external_url is null)
    or
    (attachment_type in ('external_link', 'youtube', 'vimeo')
      and storage_bucket is null and storage_path is null
      and original_filename is null and mime_type is null and byte_size is null
      and external_url ~* '^https://[^[:space:]]+$')
  ),
  constraint group_message_attachments_mime check (
    attachment_type not in ('image', 'document') or mime_type in (
      'image/jpeg','image/png','image/webp','image/gif','application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'
    )
  ),
  constraint group_message_attachments_image_size check
    (attachment_type <> 'image' or byte_size <= 10485760),
  constraint group_message_attachments_video_host check (
    attachment_type not in ('youtube','vimeo') or
    (attachment_type = 'youtube' and external_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be)([/:?#]|$)') or
    (attachment_type = 'vimeo' and external_url ~* '^https://([a-z0-9-]+\.)?vimeo\.com([/:?#]|$)')
  ),
  unique (message_id, id),
  unique (message_id, sort_order),
  unique (storage_bucket, storage_path)
);

create index group_message_attachments_active_message_idx
  on public.group_message_attachments(message_id, sort_order) where deleted_at is null;
create index group_message_attachments_active_scope_idx
  on public.group_message_attachments(group_id, thread_id) where deleted_at is null;
create index group_message_attachments_cleanup_idx
  on public.group_message_attachments(status, created_at) where deleted_at is null;
create index group_message_attachments_retention_idx
  on public.group_message_attachments(deleted_at) where deleted_at is not null;

create function public.enforce_group_message_attachment_relationship()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if not exists (
    select 1 from public.group_thread_messages m
    join public.group_threads t on t.id = m.thread_id
    where m.id = new.message_id and m.thread_id = new.thread_id and t.group_id = new.group_id
  ) then raise exception 'attachment message/thread/group mismatch' using errcode = '23514'; end if;
  return new;
end $$;

create function public.enforce_group_message_attachment_limit()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.message_id::text, 0));
  if (select count(*) from public.group_message_attachments a
      where a.message_id = new.message_id and a.deleted_at is null and a.id <> new.id) >= 5
  then raise exception 'a message may have at most five active attachments' using errcode = '23514'; end if;
  return new;
end $$;

create trigger group_message_attachments_relationship
before insert or update of message_id, thread_id, group_id on public.group_message_attachments
for each row execute function public.enforce_group_message_attachment_relationship();
create trigger group_message_attachments_limit
before insert or update of message_id, deleted_at on public.group_message_attachments
for each row execute function public.enforce_group_message_attachment_limit();

alter table public.group_message_attachments enable row level security;
revoke all on public.group_message_attachments from public, anon, authenticated;
grant select on public.group_message_attachments to authenticated;
revoke all on function public.enforce_group_message_attachment_relationship() from public;
revoke all on function public.enforce_group_message_attachment_limit() from public;

commit;
