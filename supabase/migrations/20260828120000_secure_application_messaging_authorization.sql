-- P1: canonical, acceptance-gated application messaging authorization.

begin;

create schema if not exists application_messaging_private;

revoke all on schema application_messaging_private from public, anon;
grant usage on schema application_messaging_private to authenticated, service_role;

create or replace function application_messaging_private.application_access_allowed(
  p_application_id uuid,
  p_user_id uuid,
  p_company_identity_id uuid,
  p_write boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.job_orders o
      on o.application_id = a.id
     and o.job_id = a.job_id
     and o.candidate_id = a.applicant_id
     and o.company_id is not distinct from j.company_id
    where a.id = p_application_id
      and p_user_id is not null
      and (
        (
          p_user_id = a.applicant_id
          and p_company_identity_id is null
        )
        or (
          p_user_id <> a.applicant_id
          and (
            (
              j.company_id is null
              and p_company_identity_id is null
              and p_user_id = j.poster_id
            )
            or (
              j.company_id is not null
              and p_company_identity_id = j.company_id
              and exists (
                select 1
                from public.company_members cm
                where cm.company_id = j.company_id
                  and cm.profile_id = p_user_id
                  and cm.role in ('Owner', 'Admin', 'Member')
              )
            )
          )
        )
      )
      and (
        case
          when p_write then
            a.status in ('Accepted', 'Completed')
            and o.status in (
              'Active',
              'Work Completed by Applicant',
              'Completion Confirmed by Company',
              'Payment Confirmed by Applicant',
              'Completed'
            )
          else
            a.status in (
              'Accepted',
              'Completed',
              'Candidate Cancelled',
              'Company Cancelled'
            )
            and o.status in (
              'Active',
              'Work Completed by Applicant',
              'Completion Confirmed by Company',
              'Payment Confirmed by Applicant',
              'Completed',
              'Candidate Cancelled',
              'Company Cancelled'
            )
        end
      )
  );
$function$;

create or replace function application_messaging_private.thread_access_allowed(
  p_thread_id uuid,
  p_user_id uuid,
  p_company_identity_id uuid,
  p_write boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.application_threads t
    join public.applications a on a.id = t.application_id
    join public.jobs j on j.id = a.job_id
    where t.id = p_thread_id
      and t.job_id = a.job_id
      and t.applicant_id = a.applicant_id
      and t.poster_user_id = j.poster_id
      and t.company_id is not distinct from j.company_id
      and application_messaging_private.application_access_allowed(
        a.id,
        p_user_id,
        p_company_identity_id,
        p_write
      )
  );
$function$;

-- RLS cannot carry UI identity context. This helper permits only canonical account-level
-- participants; RPCs additionally enforce the selected company identity explicitly.
create or replace function application_messaging_private.thread_visible_to_current_user(
  p_thread_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.application_threads t
    join public.applications a on a.id = t.application_id
    join public.jobs j on j.id = a.job_id
    join public.job_orders o
      on o.application_id = a.id
     and o.job_id = a.job_id
     and o.candidate_id = a.applicant_id
     and o.company_id is not distinct from j.company_id
    where t.id = p_thread_id
      and t.job_id = a.job_id
      and t.applicant_id = a.applicant_id
      and t.poster_user_id = j.poster_id
      and t.company_id is not distinct from j.company_id
      and (
        (select auth.uid()) = a.applicant_id
        or (
          j.company_id is null
          and (select auth.uid()) = j.poster_id
        )
        or (
          j.company_id is not null
          and exists (
            select 1
            from public.company_members cm
            where cm.company_id = j.company_id
              and cm.profile_id = (select auth.uid())
              and cm.role in ('Owner', 'Admin', 'Member')
          )
        )
      )
      and a.status in (
        'Accepted',
        'Completed',
        'Candidate Cancelled',
        'Company Cancelled'
      )
      and o.status in (
        'Active',
        'Work Completed by Applicant',
        'Completion Confirmed by Company',
        'Payment Confirmed by Applicant',
        'Completed',
        'Candidate Cancelled',
        'Company Cancelled'
      )
  );
$function$;

revoke all on function application_messaging_private.application_access_allowed(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function application_messaging_private.thread_access_allowed(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function application_messaging_private.thread_visible_to_current_user(uuid) from public, anon;
grant execute on function application_messaging_private.application_access_allowed(uuid,uuid,uuid,boolean) to service_role;
grant execute on function application_messaging_private.thread_access_allowed(uuid,uuid,uuid,boolean) to service_role;
grant execute on function application_messaging_private.thread_visible_to_current_user(uuid) to authenticated, service_role;

create or replace function application_messaging_private.validate_thread_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.job_orders o
      on o.application_id = a.id
     and o.job_id = a.job_id
     and o.candidate_id = a.applicant_id
     and o.company_id is not distinct from j.company_id
    where a.id = new.application_id
      and new.job_id = a.job_id
      and new.applicant_id = a.applicant_id
      and new.poster_user_id = j.poster_id
      and new.company_id is not distinct from j.company_id
      and a.status in ('Accepted', 'Completed')
      and o.status in (
        'Active',
        'Work Completed by Applicant',
        'Completion Confirmed by Company',
        'Payment Confirmed by Applicant',
        'Completed'
      )
  ) then
    raise exception 'Application thread relationship is invalid or messaging is unavailable.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function application_messaging_private.validate_thread_relationship() from public, anon, authenticated;
grant execute on function application_messaging_private.validate_thread_relationship() to service_role;

drop trigger if exists validate_application_thread_relationship on public.application_threads;
create trigger validate_application_thread_relationship
before insert or update of application_id, job_id, poster_user_id, company_id, applicant_id
on public.application_threads
for each row execute function application_messaging_private.validate_thread_relationship();

create or replace function public.get_or_create_application_thread(
  p_application_id uuid,
  p_company_identity_id uuid default null
)
returns public.application_threads
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_thread public.application_threads%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select a.* into v_application
  from public.applications a
  where a.id = p_application_id;

  if not found then
    raise exception 'Application messaging is unavailable.' using errcode = '42501';
  end if;

  select j.* into v_job
  from public.jobs j
  where j.id = v_application.job_id;

  if not found or not application_messaging_private.application_access_allowed(
    p_application_id,
    v_user_id,
    p_company_identity_id,
    false
  ) then
    raise exception 'Application messaging is unavailable.' using errcode = '42501';
  end if;

  select t.* into v_thread
  from public.application_threads t
  where t.application_id = p_application_id
  for update;

  if found then
    if v_thread.job_id <> v_application.job_id
      or v_thread.applicant_id <> v_application.applicant_id
      or v_thread.poster_user_id <> v_job.poster_id
      or v_thread.company_id is distinct from v_job.company_id then
      raise exception 'Existing application thread relationship is invalid.' using errcode = '23514';
    end if;
    return v_thread;
  end if;

  if not application_messaging_private.application_access_allowed(
    p_application_id,
    v_user_id,
    p_company_identity_id,
    true
  ) then
    raise exception 'Application messaging is unavailable.' using errcode = '42501';
  end if;

  insert into public.application_threads (
    application_id,
    job_id,
    poster_user_id,
    company_id,
    applicant_id
  ) values (
    v_application.id,
    v_application.job_id,
    v_job.poster_id,
    v_job.company_id,
    v_application.applicant_id
  )
  on conflict (application_id) do nothing
  returning * into v_thread;

  if v_thread.id is null then
    select t.* into v_thread
    from public.application_threads t
    where t.application_id = p_application_id
    for update;

    if not found
      or v_thread.job_id <> v_application.job_id
      or v_thread.applicant_id <> v_application.applicant_id
      or v_thread.poster_user_id <> v_job.poster_id
      or v_thread.company_id is distinct from v_job.company_id then
      raise exception 'Existing application thread relationship is invalid.' using errcode = '23514';
    end if;
  end if;

  return v_thread;
end;
$function$;

create or replace function public.send_application_message(
  p_thread_id uuid,
  p_message_body text,
  p_company_identity_id uuid default null
)
returns public.application_messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_message public.application_messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if nullif(btrim(p_message_body), '') is null then
    raise exception 'Message body is required.' using errcode = '22023';
  end if;

  if octet_length(p_message_body) > 32768 then
    raise exception 'Message body is too large.' using errcode = '22023';
  end if;

  if not application_messaging_private.thread_access_allowed(
    p_thread_id,
    v_user_id,
    p_company_identity_id,
    true
  ) then
    raise exception 'Application messaging is unavailable.' using errcode = '42501';
  end if;

  insert into public.application_messages (thread_id, sender_id, body)
  values (p_thread_id, v_user_id, btrim(p_message_body))
  returning * into v_message;

  return v_message;
end;
$function$;

create or replace function public.get_application_thread_states(
  p_thread_ids uuid[],
  p_company_identity_id uuid default null
)
returns table (
  thread_id uuid,
  application_status text,
  job_order_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_thread_ids), 0) > 500 then
    raise exception 'Too many application threads requested.' using errcode = '22023';
  end if;

  return query
  select t.id, a.status, o.status
  from public.application_threads t
  join public.applications a on a.id = t.application_id
  join public.jobs j on j.id = a.job_id
  join public.job_orders o
    on o.application_id = a.id
   and o.job_id = a.job_id
   and o.candidate_id = a.applicant_id
   and o.company_id is not distinct from j.company_id
  where t.id = any(coalesce(p_thread_ids, array[]::uuid[]))
    and t.job_id = a.job_id
    and t.applicant_id = a.applicant_id
    and t.poster_user_id = j.poster_id
    and t.company_id is not distinct from j.company_id
    and application_messaging_private.thread_access_allowed(
      t.id,
      v_user_id,
      p_company_identity_id,
      false
    );
end;
$function$;

revoke all on function public.get_or_create_application_thread(uuid,uuid) from public, anon;
revoke all on function public.send_application_message(uuid,text,uuid) from public, anon;
revoke all on function public.get_application_thread_states(uuid[],uuid) from public, anon;
grant execute on function public.get_or_create_application_thread(uuid,uuid) to authenticated, service_role;
grant execute on function public.send_application_message(uuid,text,uuid) to authenticated, service_role;
grant execute on function public.get_application_thread_states(uuid[],uuid) to authenticated, service_role;

drop policy if exists "Participants can insert application_threads" on public.application_threads;
drop policy if exists "Participants can read application_threads" on public.application_threads;
drop policy if exists "Participants can delete application_threads" on public.application_threads;
drop policy if exists "Canonical participants can read application_threads" on public.application_threads;

create policy "Canonical participants can read application_threads"
on public.application_threads
for select
to authenticated
using (
  (select application_messaging_private.thread_visible_to_current_user(id))
);

drop policy if exists "Sender can insert application_messages" on public.application_messages;
drop policy if exists "Participants can read application_messages" on public.application_messages;
drop policy if exists "Participants can delete application_messages" on public.application_messages;
drop policy if exists "Canonical participants can read application_messages" on public.application_messages;

create policy "Canonical participants can read application_messages"
on public.application_messages
for select
to authenticated
using (
  (select application_messaging_private.thread_visible_to_current_user(thread_id))
);

revoke all on public.application_threads from anon;
revoke all on public.application_threads from authenticated;
grant select on public.application_threads to authenticated;

revoke all on public.application_messages from anon;
revoke all on public.application_messages from authenticated;
grant select on public.application_messages to authenticated;

create or replace function public.update_app_thread_last_message()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  update public.application_threads
  set last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$function$;

revoke all on function public.update_app_thread_last_message() from public, anon, authenticated;
grant execute on function public.update_app_thread_last_message() to service_role;

create or replace function public.check_application_messaging_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
    or new.sender_id <> v_user_id
    or not application_messaging_private.thread_access_allowed(
      new.thread_id,
      v_user_id,
      case
        when exists (
          select 1
          from public.application_threads t
          join public.company_members cm on cm.company_id = t.company_id
          where t.id = new.thread_id
            and cm.profile_id = v_user_id
            and cm.role in ('Owner', 'Admin', 'Member')
        ) then (
          select t.company_id
          from public.application_threads t
          where t.id = new.thread_id
        )
        else null
      end,
      true
    ) then
    raise exception 'Application messaging is unavailable.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.check_application_messaging_status() from public, anon, authenticated;
grant execute on function public.check_application_messaging_status() to service_role;

drop trigger if exists enforce_application_messaging_status on public.application_messages;
create trigger enforce_application_messaging_status
before insert on public.application_messages
for each row execute function public.check_application_messaging_status();

comment on function public.get_or_create_application_thread(uuid,uuid) is
  'Returns or creates the canonical acceptance-gated application thread. Relationship fields are database-derived.';
comment on function public.send_application_message(uuid,text,uuid) is
  'Sends an application message after canonical participant, company identity, engagement, and lifecycle validation.';
comment on function public.get_application_thread_states(uuid[],uuid) is
  'Returns only lifecycle state for canonical application threads authorized in the selected identity context.';

commit;
