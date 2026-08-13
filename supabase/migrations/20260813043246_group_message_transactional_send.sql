-- DRAFT ONLY: Phase 1.3B migration 4/6.
begin;

create type public.group_legacy_mirror_status as enum ('pending','processing','succeeded','failed','dead_letter');
create table public.group_legacy_mirror_outbox (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.group_thread_messages(id) on delete cascade,
  thread_id uuid not null references public.group_threads(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  payload jsonb not null check (octet_length(payload::text) <= 32768),
  status public.group_legacy_mirror_status not null default 'pending',
  retry_count integer not null default 0 check (retry_count >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text check (claimed_by is null or char_length(claimed_by) <= 200),
  last_error text check (last_error is null or char_length(last_error) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index group_legacy_mirror_claim_idx on public.group_legacy_mirror_outbox(next_attempt_at, created_at)
  where status in ('pending','failed');
alter table public.group_legacy_mirror_outbox enable row level security;
revoke all on public.group_legacy_mirror_outbox from public, anon, authenticated;
grant select, insert, update on public.group_legacy_mirror_outbox to service_role;

create function public.reserve_group_thread_message(
  p_message_id uuid,
  p_thread_id uuid,
  p_content text,
  p_attachments jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user uuid := auth.uid(); v_group uuid; v_item jsonb; v_count int; v_existing record;
  v_attachment_id uuid; v_kind public.group_message_attachment_type; v_mime text; v_size bigint;
  v_ext text; v_path text; v_position int := 0; v_result jsonb;
  v_normalized_attachments jsonb; v_normalized_request jsonb;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_message_id is null or p_thread_id is null then raise exception 'message and thread ids required'; end if;
  if char_length(btrim(coalesce(p_content,''))) > 10000 then raise exception 'message content exceeds 10000 characters'; end if;
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' then raise exception 'attachments must be an array'; end if;
  v_count := jsonb_array_length(coalesce(p_attachments,'[]'::jsonb));
  if v_count > 5 then raise exception 'at most five attachments are allowed'; end if;
  if nullif(btrim(coalesce(p_content,'')), '') is null and v_count = 0 then
    raise exception 'message text or an attachment is required';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) loop
    if jsonb_typeof(v_item) <> 'object' or nullif(v_item->>'id','') is null
      or nullif(v_item->>'attachment_type','') is null
    then raise exception 'each ordered attachment descriptor requires id and attachment_type'; end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in
      ('id','attachment_type','original_filename','mime_type','byte_size','external_url','title','preview_metadata'))
    then raise exception 'attachment descriptor contains unsupported fields'; end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',(value->>'id')::uuid::text,
    'attachment_type',((value->>'attachment_type')::public.group_message_attachment_type)::text,
    'original_filename',value->>'original_filename','mime_type',value->>'mime_type',
    'byte_size',(value->>'byte_size')::bigint,'external_url',value->>'external_url',
    'title',value->>'title','preview_metadata',coalesce(value->'preview_metadata','{}'::jsonb)
  )) order by ordinality),'[]'::jsonb) into v_normalized_attachments
  from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) with ordinality;
  if (select count(distinct value->>'id') from jsonb_array_elements(v_normalized_attachments))<>v_count
  then raise exception 'attachment descriptor ids must be unique'; end if;
  v_normalized_request := jsonb_build_object('thread_id',p_thread_id::text,
    'content',btrim(coalesce(p_content,'')),'attachments',v_normalized_attachments);
  if octet_length(v_normalized_request::text) > 32768 then raise exception 'normalized request is too large'; end if;

  -- Serialize every use of this idempotency UUID before checking or inserting it.
  perform pg_advisory_xact_lock(hashtextextended(p_message_id::text, 1304));

  select t.group_id into v_group from public.group_threads t
    where t.id = p_thread_id and not t.is_deleted and not t.is_archived for share;
  if v_group is null or not group_attachments_private.is_accepted_member(v_user, v_group)
  then raise exception 'active group membership required' using errcode = '42501'; end if;

  select m.id,m.thread_id,m.user_id,m.delivery_status,m.reservation_request into v_existing
    from public.group_thread_messages m where m.id = p_message_id for update;
  if found then
    if v_existing.thread_id <> p_thread_id or v_existing.user_id <> v_user
      or v_existing.reservation_request is distinct from v_normalized_request
    then raise exception 'idempotency key already used with different normalized request' using errcode = '22023'; end if;
    return jsonb_build_object('message_id',p_message_id,'delivery_status',v_existing.delivery_status,
      'attachments',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,'attachment_type',a.attachment_type,'storage_bucket',a.storage_bucket,
        'storage_path',a.storage_path,'status',a.status) order by a.sort_order),'[]'::jsonb)
        from public.group_message_attachments a where a.message_id = p_message_id));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(value->>'id',1305))
    from jsonb_array_elements(v_normalized_attachments) order by value->>'id';
  if exists (select 1 from public.group_message_attachments a
    where a.id in (select (value->>'id')::uuid from jsonb_array_elements(v_normalized_attachments)))
  then raise exception 'an attachment descriptor id is already in use' using errcode='22023'; end if;

  insert into public.group_thread_messages(id,thread_id,user_id,content,delivery_status,reservation_request)
  values (p_message_id,p_thread_id,v_user,btrim(coalesce(p_content,'')),'draft',v_normalized_request);

  for v_item in select value from jsonb_array_elements(v_normalized_attachments) loop
    v_attachment_id := (v_item->>'id')::uuid;
    v_kind := (v_item->>'attachment_type')::public.group_message_attachment_type;
    v_mime := v_item->>'mime_type'; v_size := (v_item->>'byte_size')::bigint;
    if v_kind in ('image','document') then
      v_ext := case v_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
        when 'image/webp' then 'webp' when 'image/gif' then 'gif' when 'application/pdf' then 'pdf'
        when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
        when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx'
        when 'application/vnd.openxmlformats-officedocument.presentationml.presentation' then 'pptx'
        when 'text/plain' then 'txt' else null end;
      if v_ext is null then raise exception 'unsupported MIME type'; end if;
      v_path := concat(v_group,'/',p_thread_id,'/',v_user,'/',v_attachment_id,'/',gen_random_uuid(),'.',v_ext);
    else v_path := null; end if;
    insert into public.group_message_attachments(
      id,message_id,thread_id,group_id,uploader_id,attachment_type,storage_bucket,storage_path,
      original_filename,mime_type,byte_size,external_url,title,preview_metadata,sort_order,status)
    values (v_attachment_id,p_message_id,p_thread_id,v_group,v_user,v_kind,
      case when v_kind in ('image','document') then 'group-message-attachments' end,v_path,
      case when v_kind in ('image','document') then v_item->>'original_filename' end,v_mime,v_size,
      v_item->>'external_url',v_item->>'title',coalesce(v_item->'preview_metadata','{}'::jsonb),v_position,'pending');
    v_position := v_position + 1;
  end loop;

  select jsonb_build_object('message_id',p_message_id,'delivery_status','draft','attachments',
    coalesce(jsonb_agg(jsonb_build_object('id',a.id,'attachment_type',a.attachment_type,
      'storage_bucket',a.storage_bucket,'storage_path',a.storage_path,'status',a.status)
      order by a.sort_order),'[]'::jsonb)) into v_result
  from public.group_message_attachments a where a.message_id = p_message_id;
  return v_result;
end $$;

-- Service-only: the caller must have inspected bytes/content outside Postgres. This function proves
-- the supplied evidence matches immutable Storage metadata and persists the audit evidence.
create function public.mark_group_message_attachment_ready(
  p_attachment_id uuid,p_actual_mime_type text,p_actual_byte_size bigint,
  p_content_sha256 text,p_inspection_metadata jsonb,p_inspector text
) returns void language plpgsql security definer set search_path = pg_catalog, public, storage as $$
declare v_attachment public.group_message_attachments%rowtype; v_storage_size bigint; v_storage_mime text;
begin
  select * into v_attachment from public.group_message_attachments where id = p_attachment_id for update;
  if not found then raise exception 'attachment not found' using errcode = 'P0002'; end if;
  if p_inspection_metadata is null then raise exception 'inspection metadata is required'; end if;
  if jsonb_typeof(p_inspection_metadata) is distinct from 'object'
    or octet_length(p_inspection_metadata::text) > 16384
    or jsonb_array_length(jsonb_path_query_array(p_inspection_metadata,'$.**')) > 100
    or p_inspection_metadata->>'safe' is null or p_inspection_metadata->>'safe' <> 'true'
    or p_inspector is null or char_length(p_inspector) not between 1 and 200
  then raise exception 'trusted inspection evidence is invalid'; end if;
  if v_attachment.status = 'ready' then
    if v_attachment.actual_mime_type is distinct from p_actual_mime_type
      or v_attachment.actual_byte_size is distinct from p_actual_byte_size
      or v_attachment.content_sha256 is distinct from lower(p_content_sha256)
      or v_attachment.inspection_metadata is distinct from p_inspection_metadata
      or v_attachment.inspected_by is distinct from p_inspector
    then raise exception 'ready attachment evidence mismatch'; end if;
    return;
  end if;
  if v_attachment.status <> 'pending' or v_attachment.deleted_at is not null
    or not exists (select 1 from public.group_thread_messages m where m.id = v_attachment.message_id
      and m.delivery_status = 'draft' and not m.is_deleted)
  then raise exception 'attachment cannot be validated'; end if;

  if v_attachment.attachment_type in ('image','document') then
    if p_actual_mime_type is null or p_actual_byte_size is null or p_content_sha256 is null
      or p_inspection_metadata->>'magic_bytes_valid' is null
      or p_inspection_metadata->>'magic_bytes_valid' <> 'true'
    then raise exception 'uploaded file evidence is incomplete'; end if;
    if v_attachment.mime_type like 'application/vnd.openxmlformats-officedocument.%'
      and (p_inspection_metadata->>'office_container_valid' is null
        or p_inspection_metadata->>'office_container_valid' <> 'true')
    then raise exception 'Office container evidence is incomplete'; end if;
    select (o.metadata->>'size')::bigint, o.metadata->>'mimetype' into v_storage_size,v_storage_mime
    from storage.objects o where o.bucket_id = v_attachment.storage_bucket
      and o.name = v_attachment.storage_path for share;
    if not found or v_storage_size is distinct from p_actual_byte_size
      or v_storage_mime is distinct from p_actual_mime_type
      or p_actual_mime_type is distinct from v_attachment.mime_type
      or p_actual_byte_size is distinct from v_attachment.byte_size
      or p_content_sha256 !~ '^[0-9A-Fa-f]{64}$'
      or (v_attachment.attachment_type = 'image' and p_actual_byte_size > 10485760)
      or (v_attachment.attachment_type = 'document' and p_actual_byte_size > 26214400)
    then raise exception 'Storage metadata or trusted content evidence mismatch'; end if;
  else
    if p_actual_mime_type is not null or p_actual_byte_size is not null or p_content_sha256 is not null
      or p_inspection_metadata->>'canonical_url' is null
      or p_inspection_metadata->>'canonical_url' is distinct from v_attachment.external_url
      or p_inspection_metadata->>'ssrf_safe' is null
      or p_inspection_metadata->>'ssrf_safe' <> 'true'
    then raise exception 'trusted link evidence mismatch'; end if;
  end if;

  update public.group_message_attachments set status='ready',actual_mime_type=p_actual_mime_type,
    actual_byte_size=p_actual_byte_size,content_sha256=lower(p_content_sha256),
    inspection_metadata=p_inspection_metadata,inspected_at=now(),inspected_by=p_inspector
  where id=p_attachment_id;
end $$;

create function public.publish_group_thread_message(p_message_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_user uuid := auth.uid(); v_message public.group_thread_messages%rowtype; v_group uuid;
  v_legacy record; v_payload jsonb; v_error text;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select m.* into v_message from public.group_thread_messages m where m.id=p_message_id for update;
  if not found then raise exception 'reservation not found' using errcode = 'P0002'; end if;
  select t.group_id into v_group from public.group_threads t where t.id=v_message.thread_id
    and not t.is_deleted and not t.is_archived;
  if v_message.user_id <> v_user or v_group is null
    or not group_attachments_private.is_accepted_member(v_user,v_group)
  then raise exception 'not authorized to publish reservation' using errcode = '42501'; end if;
  if v_message.delivery_status='published' then return p_message_id; end if;
  if v_message.delivery_status<>'draft' then raise exception 'reservation is not publishable'; end if;

  -- Consistent lock order is message first, then every attachment ordered by id.
  perform 1 from public.group_message_attachments a where a.message_id=p_message_id order by a.id for update;
  if exists (select 1 from public.group_message_attachments a where a.message_id=p_message_id
    and a.deleted_at is null and a.status<>'ready')
  then raise exception 'all active attachments must be ready'; end if;
  if nullif(btrim(v_message.content),'') is null and not exists (
    select 1 from public.group_message_attachments a where a.message_id=p_message_id
      and a.deleted_at is null and a.status='ready')
  then raise exception 'message text or an active ready attachment is required'; end if;

  update public.group_thread_messages set delivery_status='published',updated_at=now() where id=p_message_id;
  update public.group_threads set last_message_at=now() where id=v_message.thread_id;
  v_payload := jsonb_build_object('id',p_message_id,'post_id',v_message.thread_id,
    'user_id',v_user,'content',v_message.content);
  begin
    insert into public.group_comments(id,post_id,user_id,content)
    values (p_message_id,v_message.thread_id,v_user,v_message.content) on conflict (id) do nothing;
    select c.id,c.post_id,c.user_id,c.content into v_legacy from public.group_comments c where c.id=p_message_id;
    if not found or v_legacy.post_id is distinct from v_message.thread_id
      or v_legacy.user_id is distinct from v_user or v_legacy.content is distinct from v_message.content
    then v_error := 'legacy id conflict does not match canonical message'; end if;
  exception when others then v_error := sqlerrm;
  end;
  if v_error is not null then
    insert into public.group_legacy_mirror_outbox(message_id,thread_id,group_id,payload,last_error)
    values (p_message_id,v_message.thread_id,v_group,v_payload,left(v_error,4000))
    on conflict (message_id) do update set payload=excluded.payload,last_error=excluded.last_error,
      status='pending',next_attempt_at=now(),updated_at=now();
  end if;
  return p_message_id;
end $$;

revoke all on function public.reserve_group_thread_message(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.mark_group_message_attachment_ready(uuid,text,bigint,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.publish_group_thread_message(uuid) from public, anon;
grant execute on function public.reserve_group_thread_message(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.mark_group_message_attachment_ready(uuid,text,bigint,text,jsonb,text) to service_role;
grant execute on function public.publish_group_thread_message(uuid) to authenticated;

commit;
