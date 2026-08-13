-- DRAFT ONLY: Phase 1.3B migration 5/6.
begin;

create function public.soft_delete_group_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_user uuid := auth.uid(); v_message public.group_thread_messages%rowtype; v_group uuid;
begin
  select m.* into v_message from public.group_thread_messages m where m.id=p_message_id for update;
  if not found then raise exception 'message not found' using errcode='P0002'; end if;
  perform 1 from public.group_message_attachments a where a.message_id=p_message_id order by a.id for update;
  select t.group_id into v_group from public.group_threads t where t.id=v_message.thread_id;
  if v_user is null or not ((v_message.user_id=v_user
      and group_attachments_private.is_accepted_member(v_user,v_group))
    or group_attachments_private.can_moderate(v_user,v_group))
  then raise exception 'not authorized' using errcode='42501'; end if;
  update public.group_thread_messages set is_deleted=true,updated_at=now() where id=p_message_id;
  update public.group_message_attachments set deleted_at=coalesce(deleted_at,now()),
    deleted_by=coalesce(deleted_by,v_user) where message_id=p_message_id and deleted_at is null;
end $$;

create function public.soft_delete_group_message_attachment(p_attachment_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_user uuid := auth.uid(); v_message_id uuid; v_message public.group_thread_messages%rowtype;
  v_target public.group_message_attachments%rowtype;
begin
  select a.message_id into v_message_id from public.group_message_attachments a where a.id=p_attachment_id;
  if not found then raise exception 'attachment not found' using errcode='P0002'; end if;
  -- Same lock order as publication: message, then all attachments ordered by id.
  select m.* into v_message from public.group_thread_messages m where m.id=v_message_id for update;
  perform 1 from public.group_message_attachments a where a.message_id=v_message_id order by a.id for update;
  select * into v_target from public.group_message_attachments where id=p_attachment_id;
  if not group_attachments_private.can_remove(v_user,p_attachment_id)
  then raise exception 'not authorized' using errcode='42501'; end if;
  if v_target.deleted_at is not null then return; end if;
  if v_message.delivery_status='published' and nullif(btrim(v_message.content),'') is null
    and v_target.status='ready' and not exists (
      select 1 from public.group_message_attachments a where a.message_id=v_message_id
        and a.id<>p_attachment_id and a.deleted_at is null and a.status='ready')
  then raise exception 'cannot remove the final active ready attachment from an attachment-only message'; end if;
  update public.group_message_attachments set deleted_at=now(),deleted_by=v_user where id=p_attachment_id;
end $$;

create function public.cancel_group_message_reservation(p_message_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_user uuid := auth.uid(); v_message public.group_thread_messages%rowtype; v_group uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  select m.* into v_message from public.group_thread_messages m where m.id=p_message_id for update;
  if not found then raise exception 'reservation not found' using errcode='P0002'; end if;
  perform 1 from public.group_message_attachments a where a.message_id=p_message_id order by a.id for update;
  select t.group_id into v_group from public.group_threads t where t.id=v_message.thread_id;
  if v_message.user_id<>v_user or not group_attachments_private.is_accepted_member(v_user,v_group)
  then raise exception 'not authorized' using errcode='42501'; end if;
  if v_message.delivery_status='cancelled' then return; end if;
  if v_message.delivery_status<>'draft' then raise exception 'only a draft reservation may be cancelled'; end if;
  update public.group_thread_messages set delivery_status='cancelled',updated_at=now() where id=p_message_id;
end $$;

revoke all on function public.soft_delete_group_message(uuid) from public, anon;
revoke all on function public.soft_delete_group_message_attachment(uuid) from public, anon;
revoke all on function public.cancel_group_message_reservation(uuid) from public, anon;
grant execute on function public.soft_delete_group_message(uuid) to authenticated;
grant execute on function public.soft_delete_group_message_attachment(uuid) to authenticated;
grant execute on function public.cancel_group_message_reservation(uuid) to authenticated;

-- Compatibility clients may insert only the audited legacy columns; delivery_status and
-- reservation_request are intentionally absent and therefore use server defaults. Confirm the three
-- reply columns against the live schema before application.
revoke insert, update, delete on public.group_thread_messages from anon, authenticated;
revoke insert(delivery_status,reservation_request),
  update(delivery_status,reservation_request,thread_id,user_id,content,is_deleted)
  on public.group_thread_messages from anon, authenticated;
grant insert(id,thread_id,user_id,content,reply_to_message_id,reply_author_name,reply_preview)
  on public.group_thread_messages to authenticated;

revoke insert, update, delete on public.group_message_attachments from anon, authenticated;

commit;
