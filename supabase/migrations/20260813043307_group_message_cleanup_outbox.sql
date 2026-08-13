-- DRAFT ONLY: Phase 1.3B migration 6/6. No scheduler or physical deletion is created.
begin;

create type public.group_attachment_cleanup_reason as enum ('orphan_upload','retention_expired','delete_retry');
create type public.group_attachment_cleanup_status as enum
  ('pending','processing','succeeded','failed','cancelled','dead_letter');
create table public.group_attachment_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid references public.group_message_attachments(id) on delete set null,
  storage_bucket text not null check (storage_bucket='group-message-attachments'),
  storage_path text not null check (char_length(storage_path)<=1024),
  reason public.group_attachment_cleanup_reason not null,
  eligible_at timestamptz not null,
  status public.group_attachment_cleanup_status not null default 'pending',
  retry_count integer not null default 0 check (retry_count>=0),
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by text check (claimed_by is null or char_length(claimed_by)<=200),
  last_error text check (last_error is null or char_length(last_error)<=4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storage_bucket,storage_path,reason)
);
create index group_attachment_cleanup_claim_idx
  on public.group_attachment_cleanup_queue(next_attempt_at,eligible_at,created_at)
  where status in ('pending','failed');
alter table public.group_attachment_cleanup_queue enable row level security;
revoke all on public.group_attachment_cleanup_queue from public, anon, authenticated;
grant select, insert, update on public.group_attachment_cleanup_queue to service_role;

create table public.group_message_reservation_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.group_thread_messages(id) on delete cascade,
  eligible_at timestamptz not null,
  status public.group_attachment_cleanup_status not null default 'pending',
  retry_count integer not null default 0 check (retry_count>=0),
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by text check (claimed_by is null or char_length(claimed_by)<=200),
  last_error text check (last_error is null or char_length(last_error)<=4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index group_message_reservation_cleanup_claim_idx
  on public.group_message_reservation_cleanup_queue(next_attempt_at,eligible_at,created_at)
  where status in ('pending','failed');
alter table public.group_message_reservation_cleanup_queue enable row level security;
revoke all on public.group_message_reservation_cleanup_queue from public, anon, authenticated;
grant select, insert, update on public.group_message_reservation_cleanup_queue to service_role;

create function public.enqueue_due_group_attachment_cleanup(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_reservations integer:=0; v_attachments integer:=0;
begin
  insert into public.group_message_reservation_cleanup_queue(message_id,eligible_at,next_attempt_at)
  select m.id,m.created_at+interval '24 hours',p_now from public.group_thread_messages m
  where m.delivery_status in ('draft','cancelled') and m.created_at+interval '24 hours'<=p_now
  on conflict(message_id) do nothing;
  get diagnostics v_reservations=row_count;

  insert into public.group_attachment_cleanup_queue
    (attachment_id,storage_bucket,storage_path,reason,eligible_at,next_attempt_at)
  select a.id,a.storage_bucket,a.storage_path,
    case when a.deleted_at is not null then 'retention_expired'::public.group_attachment_cleanup_reason
      else 'orphan_upload'::public.group_attachment_cleanup_reason end,
    case when a.deleted_at is not null then a.deleted_at+interval '30 days'
      else a.created_at+interval '24 hours' end,p_now
  from public.group_message_attachments a
  join public.group_thread_messages m on m.id=a.message_id
  where a.storage_path is not null and (
    (a.deleted_at is not null and a.deleted_at+interval '30 days'<=p_now)
    or (a.deleted_at is null and a.created_at+interval '24 hours'<=p_now
      and (a.status in ('pending','failed') or m.delivery_status in ('draft','cancelled')))
  ) on conflict do nothing;
  get diagnostics v_attachments=row_count;
  return v_reservations+v_attachments;
end $$;

-- Returns immutable deletion coordinates only after locking and revalidating current canonical state.
-- The worker must call this immediately before the Storage API deletion; null means safely cancelled.
create function public.claim_group_attachment_cleanup(
  p_job_id uuid,p_worker text,p_now timestamptz default now()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_job public.group_attachment_cleanup_queue%rowtype;
  v_attachment public.group_message_attachments%rowtype; v_message public.group_thread_messages%rowtype;
  v_eligible boolean:=false;
begin
  if char_length(coalesce(p_worker,'')) not between 1 and 200 then raise exception 'invalid worker id'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text,1306));
  select * into v_job from public.group_attachment_cleanup_queue where id=p_job_id;
  if not found or v_job.status not in ('pending','failed') or v_job.next_attempt_at>p_now then return null; end if;
  if v_job.attachment_id is null then
    update public.group_attachment_cleanup_queue set status='cancelled',last_error='attachment row missing; manual audit required',
      updated_at=p_now where id=p_job_id; return null;
  end if;
  select * into v_attachment from public.group_message_attachments where id=v_job.attachment_id;
  if not found then
    update public.group_attachment_cleanup_queue set status='cancelled',last_error='attachment row missing; manual audit required',
      updated_at=p_now where id=p_job_id; return null;
  end if;
  select * into v_message from public.group_thread_messages where id=v_attachment.message_id for update;
  if not found then
    update public.group_attachment_cleanup_queue set status='cancelled',
      last_error='canonical message missing; manual audit required',updated_at=p_now where id=p_job_id;
    return null;
  end if;
  perform 1 from public.group_message_attachments a where a.message_id=v_attachment.message_id order by a.id for update;
  select * into v_attachment from public.group_message_attachments where id=v_job.attachment_id;
  select * into v_job from public.group_attachment_cleanup_queue where id=p_job_id for update;

  v_eligible := coalesce(v_job.storage_bucket=v_attachment.storage_bucket
    and v_job.storage_path=v_attachment.storage_path and (
      (v_job.reason='retention_expired' and v_attachment.deleted_at is not null
        and v_attachment.deleted_at+interval '30 days'<=p_now)
      or (v_job.reason in ('orphan_upload','delete_retry') and v_attachment.deleted_at is null
        and v_attachment.created_at+interval '24 hours'<=p_now
        and v_message.delivery_status in ('draft','cancelled')
        and v_attachment.status in ('pending','failed'))
    ),false);
  if not v_eligible then
    update public.group_attachment_cleanup_queue set status='cancelled',claimed_at=null,claimed_by=null,
      last_error='canonical state no longer eligible',updated_at=p_now where id=p_job_id;
    return null;
  end if;
  update public.group_attachment_cleanup_queue set status='processing',claimed_at=p_now,
    claimed_by=p_worker,last_error=null,updated_at=p_now where id=p_job_id;
  return jsonb_build_object('job_id',p_job_id,'attachment_id',v_attachment.id,
    'storage_bucket',v_job.storage_bucket,'storage_path',v_job.storage_path);
end $$;

create function public.claim_group_message_reservation_cleanup(
  p_job_id uuid,p_worker text,p_now timestamptz default now()
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_job public.group_message_reservation_cleanup_queue%rowtype;
  v_message public.group_thread_messages%rowtype;
begin
  if char_length(coalesce(p_worker,'')) not between 1 and 200 then raise exception 'invalid worker id'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text,1307));
  select * into v_job from public.group_message_reservation_cleanup_queue where id=p_job_id;
  if not found or v_job.status not in ('pending','failed') or v_job.next_attempt_at>p_now then return null; end if;
  select * into v_message from public.group_thread_messages where id=v_job.message_id for update;
  if not found or v_message.delivery_status not in ('draft','cancelled')
    or v_message.created_at+interval '24 hours'>p_now then
    update public.group_message_reservation_cleanup_queue set status='cancelled',
      last_error='canonical message no longer eligible',updated_at=p_now where id=p_job_id;
    return null;
  end if;
  perform 1 from public.group_message_attachments a where a.message_id=v_message.id order by a.id for update;
  select * into v_job from public.group_message_reservation_cleanup_queue where id=p_job_id for update;
  update public.group_message_reservation_cleanup_queue set status='processing',claimed_at=p_now,
    claimed_by=p_worker,last_error=null,updated_at=p_now where id=p_job_id;
  return v_message.id;
end $$;

-- Publishing uses the same message->attachments lock order. Pending stale jobs are cancelled;
-- processing jobs block publication until the worker records success/failure.
create function group_attachments_private.guard_message_publication_cleanup()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.delivery_status='draft' and new.delivery_status='published' then
    perform 1 from public.group_message_attachments a where a.message_id=new.id order by a.id for update;
    if exists (select 1 from public.group_message_reservation_cleanup_queue q
        where q.message_id=new.id and q.status='processing')
      or exists (select 1 from public.group_attachment_cleanup_queue q
        join public.group_message_attachments a on a.id=q.attachment_id
        where a.message_id=new.id and q.status='processing')
    then raise exception 'cleanup is already processing for this reservation'; end if;
    update public.group_message_reservation_cleanup_queue set status='cancelled',
      last_error='reservation published',updated_at=now()
      where message_id=new.id and status in ('pending','failed');
    update public.group_attachment_cleanup_queue q set status='cancelled',
      last_error='reservation published',updated_at=now()
      from public.group_message_attachments a where a.id=q.attachment_id and a.message_id=new.id
        and q.reason in ('orphan_upload','delete_retry') and q.status in ('pending','failed');
  end if;
  return new;
end $$;
create trigger group_message_publication_cleanup_guard before update of delivery_status
on public.group_thread_messages for each row execute function group_attachments_private.guard_message_publication_cleanup();

revoke all on function public.enqueue_due_group_attachment_cleanup(timestamptz) from public,anon,authenticated;
revoke all on function public.claim_group_attachment_cleanup(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.claim_group_message_reservation_cleanup(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function group_attachments_private.guard_message_publication_cleanup() from public,anon,authenticated;
grant execute on function public.enqueue_due_group_attachment_cleanup(timestamptz) to service_role;
grant execute on function public.claim_group_attachment_cleanup(uuid,text,timestamptz) to service_role;
grant execute on function public.claim_group_message_reservation_cleanup(uuid,text,timestamptz) to service_role;

comment on function public.enqueue_due_group_attachment_cleanup(timestamptz) is
  'Returns the sum of newly inserted reservation jobs and attachment jobs; conflicts are not counted.';
comment on table public.group_legacy_mirror_outbox is
  'Idempotent compatibility mirror work keyed by canonical message_id; service workers claim with SKIP LOCKED.';
comment on table public.group_attachment_cleanup_queue is
  'Discovery queue only. claim_group_attachment_cleanup must revalidate before every physical deletion.';
comment on table public.group_message_reservation_cleanup_queue is
  'Hidden draft/cancelled reservation cleanup queue; workers must revalidate delivery_status under lock.';

commit;
