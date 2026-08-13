-- DRAFT ONLY: Phase 1.3B migration 2/6.
begin;

create schema group_attachments_private;
revoke all on schema group_attachments_private from public, anon, authenticated;
grant usage on schema group_attachments_private to authenticated, service_role;

-- Deployed MarComn currently names accepted membership status "member".
create function group_attachments_private.is_accepted_member(p_user_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and (
    exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_user_id)
    or exists (select 1 from public.group_members gm where gm.group_id = p_group_id
      and gm.user_id = p_user_id and gm.status = 'member')
  )
$$;

create function group_attachments_private.can_moderate(p_user_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and (
    exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_user_id)
    or exists (select 1 from public.group_members gm where gm.group_id = p_group_id
      and gm.user_id = p_user_id and gm.status = 'member' and gm.role in ('admin','moderator'))
  )
$$;

create function group_attachments_private.can_remove(p_user_id uuid, p_attachment_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and exists (
    select 1 from public.group_message_attachments a
    join public.group_thread_messages m on m.id = a.message_id
    where a.id = p_attachment_id and (
      (group_attachments_private.is_accepted_member(p_user_id, a.group_id)
        and p_user_id in (a.uploader_id, m.user_id))
      or group_attachments_private.can_moderate(p_user_id, a.group_id)
    )
  )
$$;

revoke all on function group_attachments_private.is_accepted_member(uuid,uuid) from public, anon;
revoke all on function group_attachments_private.can_moderate(uuid,uuid) from public, anon;
revoke all on function group_attachments_private.can_remove(uuid,uuid) from public, anon;
grant execute on function group_attachments_private.is_accepted_member(uuid,uuid) to authenticated, service_role;
grant execute on function group_attachments_private.can_moderate(uuid,uuid) to authenticated, service_role;
grant execute on function group_attachments_private.can_remove(uuid,uuid) to authenticated, service_role;

create policy group_message_attachments_read on public.group_message_attachments
for select to authenticated using (
  deleted_at is null
  and group_attachments_private.is_accepted_member((select auth.uid()), group_id)
  and exists (select 1 from public.group_threads t where t.id = thread_id
    and t.group_id = group_id and not t.is_deleted and not t.is_archived)
  and exists (select 1 from public.group_thread_messages m where m.id = message_id
    and m.thread_id = thread_id and m.delivery_status = 'published' and not m.is_deleted)
);

-- A restrictive guard composes with the deployed permissive message SELECT policy and closes
-- cross-group/former-member access without broadening access if that policy is later removed.
create policy group_thread_messages_active_member_guard on public.group_thread_messages
as restrictive for select to authenticated using (
  delivery_status = 'published' and not is_deleted and exists (
    select 1 from public.group_threads t where t.id = thread_id and not t.is_deleted
      and not t.is_archived
      and group_attachments_private.is_accepted_member((select auth.uid()), t.group_id)
  )
);
create policy group_thread_messages_anonymous_deny on public.group_thread_messages
as restrictive for select to anon using (false);

-- Restrictive compatibility guard: even if a permissive legacy INSERT policy remains, browser
-- inserts can create only published messages authored by the caller in an active joined Group.
create policy group_thread_messages_legacy_insert_guard on public.group_thread_messages
as restrictive for insert to authenticated with check (
  user_id = (select auth.uid())
  and delivery_status = 'published'
  and reservation_request is null
  and exists (
    select 1 from public.group_threads t
    where t.id = thread_id and not t.is_deleted and not t.is_archived
      and group_attachments_private.is_accepted_member((select auth.uid()),t.group_id)
  )
);

-- Direct INSERT/UPDATE/DELETE remain denied. The narrowly scoped RPCs own mutations.

commit;
