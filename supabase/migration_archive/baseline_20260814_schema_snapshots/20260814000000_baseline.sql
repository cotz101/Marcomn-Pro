


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "group_attachments_private";


ALTER SCHEMA "group_attachments_private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."group_attachment_cleanup_reason" AS ENUM (
    'orphan_upload',
    'retention_expired',
    'delete_retry'
);


ALTER TYPE "public"."group_attachment_cleanup_reason" OWNER TO "postgres";


CREATE TYPE "public"."group_attachment_cleanup_status" AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled',
    'dead_letter'
);


ALTER TYPE "public"."group_attachment_cleanup_status" OWNER TO "postgres";


CREATE TYPE "public"."group_legacy_mirror_status" AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'dead_letter'
);


ALTER TYPE "public"."group_legacy_mirror_status" OWNER TO "postgres";


CREATE TYPE "public"."group_message_attachment_status" AS ENUM (
    'pending',
    'ready',
    'failed',
    'quarantined'
);


ALTER TYPE "public"."group_message_attachment_status" OWNER TO "postgres";


CREATE TYPE "public"."group_message_attachment_type" AS ENUM (
    'image',
    'document',
    'external_link',
    'youtube',
    'vimeo'
);


ALTER TYPE "public"."group_message_attachment_type" OWNER TO "postgres";


CREATE TYPE "public"."platform_global_role" AS ENUM (
    'super_user',
    'corporate_recruiter',
    'verified_pro',
    'guest_user',
    'super_admin',
    'admin',
    'brand_manager'
);


ALTER TYPE "public"."platform_global_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "group_attachments_private"."can_moderate"("p_user_id" "uuid", "p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and (
    exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_user_id)
    or exists (select 1 from public.group_members gm where gm.group_id = p_group_id
      and gm.user_id = p_user_id and gm.status = 'member' and gm.role in ('admin','moderator'))
  )
$$;


ALTER FUNCTION "group_attachments_private"."can_moderate"("p_user_id" "uuid", "p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "group_attachments_private"."can_remove"("p_user_id" "uuid", "p_attachment_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "group_attachments_private"."can_remove"("p_user_id" "uuid", "p_attachment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "group_attachments_private"."guard_message_publication_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "group_attachments_private"."guard_message_publication_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "group_attachments_private"."is_accepted_member"("p_user_id" "uuid", "p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select p_user_id is not null and p_user_id=(select auth.uid()) and (
    exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = p_user_id)
    or exists (select 1 from public.group_members gm where gm.group_id = p_group_id
      and gm.user_id = p_user_id and gm.status = 'member')
  )
$$;


ALTER FUNCTION "group_attachments_private"."is_accepted_member"("p_user_id" "uuid", "p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "group_attachments_private"."object_authorized"("p_user_id" "uuid", "p_object_name" "text", "p_write" boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'storage'
    AS $$
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


ALTER FUNCTION "group_attachments_private"."object_authorized"("p_user_id" "uuid", "p_object_name" "text", "p_write" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_job_offer"("app_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_job_id UUID;
  v_num_positions INT;
  v_filled_positions INT;
  v_app_status TEXT;
  v_applicant_id UUID;
  v_success BOOLEAN := FALSE;
  v_message TEXT := '';
BEGIN
  -- 1. Fetch application details to validate state
  SELECT job_id, status, applicant_id INTO v_job_id, v_app_status, v_applicant_id
  FROM public.applications
  WHERE id = app_id;

  -- Validation A: Application exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'message', 'Application not found');
  END IF;

  -- Validation B: Security check to ensure auth.uid() matches the applicant_id for authenticated roles
  IF auth.role() = 'authenticated' AND (auth.uid() IS NULL OR auth.uid() <> v_applicant_id) THEN
    RETURN json_build_object('success', FALSE, 'message', 'Unauthorized: You can only accept your own job offers.');
  END IF;

  -- Validation C: Verify application is in Offered status (not already Accepted, Completed, or Expired)
  IF v_app_status = 'Accepted' THEN
    RETURN json_build_object('success', TRUE, 'message', 'Offer already accepted');
  END IF;
  
  IF v_app_status <> 'Offered' THEN
    RETURN json_build_object('success', FALSE, 'message', 'Application is not in Offered status. Current status: ' || v_app_status);
  END IF;

  -- Validation D: Check if job exists before FOR UPDATE locking
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job_id) THEN
    RETURN json_build_object('success', FALSE, 'message', 'Associated job not found');
  END IF;

  -- Lock the job row to prevent concurrent updates
  SELECT COALESCE(number_of_positions, 1) INTO v_num_positions
  FROM public.jobs
  WHERE id = v_job_id
  FOR UPDATE;

  -- Validation E: Capacity validation after locking
  SELECT COUNT(*)::INT INTO v_filled_positions
  FROM public.applications
  WHERE job_id = v_job_id AND status IN ('Accepted', 'Completed');

  IF v_filled_positions >= v_num_positions THEN
    RETURN json_build_object('success', FALSE, 'message', 'All positions for this job are already filled');
  END IF;

  -- Perform the status update
  UPDATE public.applications
  SET status = 'Accepted'
  WHERE id = app_id;

  -- Recalculate filled positions after update
  SELECT COUNT(*)::INT INTO v_filled_positions
  FROM public.applications
  WHERE job_id = v_job_id AND status IN ('Accepted', 'Completed');

  v_success := TRUE;
  v_message := 'Offer accepted successfully';

  RETURN json_build_object(
    'success', v_success,
    'message', v_message,
    'filled_count', v_filled_positions,
    'num_positions', v_num_positions,
    'reached_cap', (v_filled_positions >= v_num_positions)
  );
END;
$$;


ALTER FUNCTION "public"."accept_job_offer"("app_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_wallet_balance"("p_wallet_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_transaction_type" "text", "p_justification_note" "text", "p_created_by" "uuid", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_override_insufficient" boolean DEFAULT false) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_balance NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_status TEXT;
BEGIN
    -- Security check: allow service_role bypass or require admin status/permissions
    IF auth.role() <> 'service_role' AND NOT (
        public.is_admin_user(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND global_role IN ('super_admin', 'admin')
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators or server services can adjust wallet balance.';
    END IF;

    -- Validate inputs
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be positive. Provided: %', p_amount;
    END IF;

    IF p_direction NOT IN ('credit', 'debit') THEN
        RAISE EXCEPTION 'Direction must be credit or debit. Provided: %', p_direction;
    END IF;

    IF p_transaction_type NOT IN ('admin_grant', 'admin_deduct', 'purchase_pending', 'purchase_completed', 'spend', 'refund', 'adjustment', 'penalty', 'platform_revenue') THEN
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;

    IF p_transaction_type IN ('admin_grant', 'admin_deduct') AND (p_justification_note IS NULL OR trim(p_justification_note) = '') THEN
        RAISE EXCEPTION 'Justification note is required for admin adjustments.';
    END IF;

    -- Lock wallet row
    SELECT balance, status INTO v_current_balance, v_status
    FROM public.mcredit_wallets
    WHERE id = p_wallet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet with ID % not found.', p_wallet_id;
    END IF;

    IF v_status != 'active' THEN
        RAISE EXCEPTION 'Wallet is not active. Status: %', v_status;
    END IF;

    -- Calculate new balance
    IF p_direction = 'credit' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSE
        v_new_balance := v_current_balance - p_amount;
        IF v_new_balance < 0 AND NOT p_override_insufficient THEN
            RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Deduct: %', v_current_balance, p_amount;
        END IF;
    END IF;

    -- Update wallet balance
    UPDATE public.mcredit_wallets
    SET balance = v_new_balance,
        updated_at = now()
    WHERE id = p_wallet_id;

    -- Log transaction
    INSERT INTO public.mcredit_transactions (
        wallet_id,
        transaction_type,
        direction,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description,
        justification_note,
        created_by,
        created_at
    )
    VALUES (
        p_wallet_id,
        p_transaction_type,
        p_direction,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_reference_type,
        p_reference_id,
        COALESCE(p_justification_note, 'Wallet transaction ' || p_transaction_type),
        p_justification_note,
        p_created_by,
        now()
    );

    RETURN v_new_balance;
END;
$$;


ALTER FUNCTION "public"."adjust_wallet_balance"("p_wallet_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_transaction_type" "text", "p_justification_note" "text", "p_created_by" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_override_insufficient" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_group_message_reservation"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_group_message_reservation"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_application_messaging_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    app_status text;
    normalized_status text;
BEGIN
    -- Fetch the application status securely based on the thread
    SELECT a.status INTO app_status
    FROM public.applications a
    JOIN public.application_threads t ON a.id = t.application_id
    WHERE t.id = NEW.thread_id;

    -- Normalize status to lowercase, replace spaces with underscores for safe comparison
    normalized_status := LOWER(REPLACE(app_status, ' ', '_'));

    IF normalized_status NOT IN ('shortlisted', 'accepted', 'active_engagement') THEN
        RAISE EXCEPTION 'Messaging is only allowed for Shortlisted, Accepted, or Active Engagement applications. Current status: %', app_status;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_application_messaging_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_conversation_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Require the inserting user to be one of the participants
  -- This inherently blocks company IDs since auth.uid() is the personal profile ID
  IF auth.uid() != NEW.participant_one AND auth.uid() != NEW.participant_two THEN
    RAISE EXCEPTION 'You can only create conversations for yourself.';
  END IF;

  -- Ensure an accepted friendship exists between the two participants
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE (
      (requester_id = NEW.participant_one AND recipient_id = NEW.participant_two)
      OR 
      (requester_id = NEW.participant_two AND recipient_id = NEW.participant_one)
    )
    AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Direct messaging requires an accepted friendship.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_conversation_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_job_compensation_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IN ('Published', 'Open') AND (
    NEW.salary_range IS DISTINCT FROM OLD.salary_range OR
    NEW.salary_numeric IS DISTINCT FROM OLD.salary_numeric OR
    NEW.pay_rate_quantity IS DISTINCT FROM OLD.pay_rate_quantity
  ) THEN
    RAISE EXCEPTION 'Compensation fields cannot be modified after a job has been published.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_job_compensation_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_job_order_existence_v1"("p_id" "uuid") RETURNS TABLE("exists_db" boolean, "status" "text", "candidate_id" "uuid", "job_id" "uuid", "poster_id" "uuid", "company_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as exists_db,
    jo.status::text,
    jo.candidate_id,
    jo.job_id,
    j.poster_id,
    j.company_id
  FROM job_orders jo
  LEFT JOIN jobs j ON j.id = jo.job_id
  WHERE jo.id = p_id;
END;
$$;


ALTER FUNCTION "public"."check_job_order_existence_v1"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_message_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_participant_one UUID;
  v_participant_two UUID;
BEGIN
  -- Require the inserting user to be the sender
  IF auth.uid() != NEW.sender_id THEN
    RAISE EXCEPTION 'You can only send messages as yourself.';
  END IF;

  -- Fetch conversation participants
  SELECT participant_one, participant_two 
  INTO v_participant_one, v_participant_two 
  FROM conversations 
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found.';
  END IF;

  -- Ensure the sender is actually a participant in the conversation
  IF NEW.sender_id != v_participant_one AND NEW.sender_id != v_participant_two THEN
    RAISE EXCEPTION 'You are not a participant in this conversation.';
  END IF;

  -- Ensure the friendship is STILL accepted (in case it was removed after conversation was created)
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE (
      (requester_id = v_participant_one AND recipient_id = v_participant_two)
      OR 
      (requester_id = v_participant_two AND recipient_id = v_participant_one)
    )
    AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Active friendship is required to send messages.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_message_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_group_attachment_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."claim_group_attachment_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_group_message_reservation_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone DEFAULT "now"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."claim_group_message_reservation_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_completed_engagement_by_company"("p_job_order_id" "uuid", "p_sentiment" "text", "p_tags" "text"[], "p_comment" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_job_order RECORD;
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_company_name text;
  v_company_logo text;
BEGIN
  -- 1. Get the job order
  SELECT jo.*, j.poster_id, j.company_id, j.title as job_title
  INTO v_job_order
  FROM job_orders jo
  JOIN jobs j ON jo.job_id = j.id
  WHERE jo.id = p_job_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job order not found');
  END IF;

  -- 2. Verify authorization
  IF v_job_order.poster_id = v_user_id THEN
    v_is_authorized := true;
  ELSIF v_job_order.company_id IS NOT NULL THEN
    PERFORM 1 FROM company_members
    WHERE company_id = v_job_order.company_id
      AND profile_id = v_user_id;
    IF FOUND THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: only the job poster or an authorized company member can perform this action');
  END IF;

  -- 3. Validate status
  IF v_job_order.status != 'Payment Confirmed by Applicant' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status transition. Current status: ' || v_job_order.status);
  END IF;

  -- 4. Update job_orders
  UPDATE job_orders
  SET status = 'Completed',
      engagement_closed_at = now(),
      updated_at = now()
  WHERE id = p_job_order_id;

  -- 5. Update application
  IF v_job_order.application_id IS NOT NULL THEN
    UPDATE applications
    SET status = 'Completed'
    WHERE id = v_job_order.application_id;
  END IF;

  -- 6. Insert Feedback if sentiment is provided and doesn't exist
  IF p_sentiment IS NOT NULL AND p_sentiment != '' THEN
    PERFORM 1 FROM job_feedback WHERE job_order_id = p_job_order_id;
    IF NOT FOUND THEN
      INSERT INTO job_feedback (
        job_order_id, job_id, application_id, company_id, candidate_id,
        feedback_by, feedback_sentiment, feedback_tags, feedback_comment,
        feedback_context, created_at
      )
      VALUES (
        p_job_order_id, v_job_order.job_id, v_job_order.application_id, v_job_order.company_id, v_job_order.candidate_id,
        v_user_id, p_sentiment, p_tags, p_comment,
        'completed_job', now()
      );
    END IF;
  END IF;

  -- 7. Get company or poster name for notification
  IF v_job_order.company_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_company_name, v_company_logo FROM companies WHERE id = v_job_order.company_id;
  END IF;

  IF v_company_name IS NULL THEN
    SELECT name, avatar_url INTO v_company_name, v_company_logo FROM profiles WHERE id = v_job_order.poster_id;
  END IF;

  -- Explicit checks instead of Postgres runtime exceptions
  IF v_company_name IS NULL THEN
    v_company_name := 'Company';
  END IF;

  RETURN json_build_object(
    'success', true,
    'candidate_id', v_job_order.candidate_id,
    'job_id', v_job_order.job_id,
    'application_id', v_job_order.application_id,
    'company_id', v_job_order.company_id,
    'job_title', v_job_order.job_title,
    'company_name', v_company_name,
    'company_logo_url', v_company_logo
  );
END;
$$;


ALTER FUNCTION "public"."close_completed_engagement_by_company"("p_job_order_id" "uuid", "p_sentiment" "text", "p_tags" "text"[], "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_work_completed_by_company"("p_job_order_id" "uuid", "p_note" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_job_order RECORD;
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_company_name text;
  v_company_logo text;
BEGIN
  -- 1. Get the job order and join with jobs to get poster_id and company_id
  SELECT jo.*, j.poster_id, j.company_id, j.title as job_title
  INTO v_job_order
  FROM job_orders jo
  JOIN jobs j ON jo.job_id = j.id
  WHERE jo.id = p_job_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job order not found');
  END IF;

  -- 2. Verify authorization
  IF v_job_order.poster_id = v_user_id THEN
    v_is_authorized := true;
  ELSIF v_job_order.company_id IS NOT NULL THEN
    PERFORM 1 FROM company_members
    WHERE company_id = v_job_order.company_id
      AND profile_id = v_user_id;
    IF FOUND THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: only the job poster or an authorized company member can perform this action');
  END IF;

  -- 3. Validate status
  IF v_job_order.status != 'Work Completed by Applicant' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status transition. Current status: ' || v_job_order.status);
  END IF;

  -- 4. Update job_order
  UPDATE job_orders
  SET status = 'Completion Confirmed by Company',
      completion_confirmed_by_company_at = now(),
      company_completion_note = p_note,
      updated_at = now()
  WHERE id = p_job_order_id;

  -- 5. Get company or poster name for notification
  IF v_job_order.company_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_company_name, v_company_logo FROM companies WHERE id = v_job_order.company_id;
  END IF;

  IF v_company_name IS NULL THEN
    SELECT name, avatar_url INTO v_company_name, v_company_logo FROM profiles WHERE id = v_job_order.poster_id;
  END IF;

  -- Explicit checks instead of Postgres runtime exceptions
  IF v_company_name IS NULL THEN
    v_company_name := 'Company';
  END IF;

  RETURN json_build_object(
    'success', true,
    'candidate_id', v_job_order.candidate_id,
    'job_id', v_job_order.job_id,
    'job_title', v_job_order.job_title,
    'company_id', v_job_order.company_id,
    'company_name', v_company_name,
    'company_logo_url', v_company_logo
  );
END;
$$;


ALTER FUNCTION "public"."confirm_work_completed_by_company"("p_job_order_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_platform_admin_access"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admin_user_roles ur
    JOIN platform_admin_roles r ON r.id = ur.role_id
    JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
    JOIN platform_admin_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND p.permission_key = 'can_access_platform_admin'
  );
$$;


ALTER FUNCTION "public"."current_user_has_platform_admin_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_platform_admin_permission"("required_permission" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admin_user_roles ur
    JOIN platform_admin_roles r ON r.id = ur.role_id
    JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
    JOIN platform_admin_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND p.permission_key = required_permission
  );
$$;


ALTER FUNCTION "public"."current_user_has_platform_admin_permission"("required_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_group_message_attachment_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.message_id::text, 0));
  if (select count(*) from public.group_message_attachments a
      where a.message_id = new.message_id and a.deleted_at is null and a.id <> new.id) >= 5
  then raise exception 'a message may have at most five active attachments' using errcode = '23514'; end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_group_message_attachment_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_group_message_attachment_relationship"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  if not exists (
    select 1 from public.group_thread_messages m
    join public.group_threads t on t.id = m.thread_id
    where m.id = new.message_id and m.thread_id = new.thread_id and t.group_id = new.group_id
  ) then raise exception 'attachment message/thread/group mismatch' using errcode = '23514'; end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_group_message_attachment_relationship"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_group_thread_message_delivery_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_group_thread_message_delivery_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_due_group_attachment_cleanup"("p_now" timestamp with time zone DEFAULT "now"()) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."enqueue_due_group_attachment_cleanup"("p_now" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_due_group_attachment_cleanup"("p_now" timestamp with time zone) IS 'Returns the sum of newly inserted reservation jobs and attachment jobs; conflicts are not counted.';



CREATE OR REPLACE FUNCTION "public"."get_group_attachment_validation_candidate"("p_attachment_id" "uuid", "p_requesting_user_id" "uuid") RETURNS TABLE("attachment_id" "uuid", "message_id" "uuid", "attachment_type" "public"."group_message_attachment_type", "storage_bucket" "text", "storage_path" "text", "declared_mime_type" "text", "declared_byte_size" bigint, "external_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."get_group_attachment_validation_candidate"("p_attachment_id" "uuid", "p_requesting_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_filled_positions"("job_uuid" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.applications
  WHERE job_id = job_uuid AND status IN ('Accepted', 'Completed');
$$;


ALTER FUNCTION "public"."get_job_filled_positions"("job_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_wallet"("p_owner_type" "text", "p_owner_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Try to find existing wallet
  IF p_owner_id IS NULL THEN
    SELECT id INTO v_wallet_id FROM mcredit_wallets
      WHERE owner_type = p_owner_type AND owner_id IS NULL LIMIT 1;
  ELSE
    SELECT id INTO v_wallet_id FROM mcredit_wallets
      WHERE owner_type = p_owner_type AND owner_id = p_owner_id LIMIT 1;
  END IF;

  -- Create if not found
  IF v_wallet_id IS NULL THEN
    INSERT INTO mcredit_wallets (owner_type, owner_id, balance, status)
    VALUES (p_owner_type, p_owner_id, 0.00, 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_wallet_id;
    
    -- If conflict, fetch again
    IF v_wallet_id IS NULL THEN
      IF p_owner_id IS NULL THEN
        SELECT id INTO v_wallet_id FROM mcredit_wallets
          WHERE owner_type = p_owner_type AND owner_id IS NULL LIMIT 1;
      ELSE
        SELECT id INTO v_wallet_id FROM mcredit_wallets
          WHERE owner_type = p_owner_type AND owner_id = p_owner_id LIMIT 1;
      END IF;
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_wallet"("p_owner_type" "text", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_topup_requests_admin"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role text;
  v_has_permission boolean;
BEGIN
  -- Validate caller is admin via legacy role
  SELECT global_role::text INTO v_role
    FROM profiles WHERE id = auth.uid();

  -- Validate caller has permission
  SELECT EXISTS (
    SELECT 1
    FROM platform_admin_user_roles ur
    JOIN platform_admin_roles r ON r.id = ur.role_id
    JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
    JOIN platform_admin_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND p.permission_key = 'can_view_wallet_control'
  ) INTO v_has_permission;

  IF (v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'brand_manager')) AND NOT v_has_permission THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        req.id,
        req.owner_type,
        req.owner_id,
        req.requester_id,
        req.amount,
        req.status,
        req.remarks,
        req.created_at,
        -- Requester (personal)
        p.name         AS requester_name,
        p.avatar_url   AS requester_avatar_url,
        -- Company identity (only when owner_type = 'company')
        c.name         AS company_name,
        c.logo_url     AS company_logo_url
      FROM mcredit_topup_requests req
      LEFT JOIN profiles  p ON p.id  = req.requester_id
      LEFT JOIN companies c ON c.id  = req.owner_id AND req.owner_type = 'company'
      WHERE req.status = 'Pending' AND req.payment_method = 'dummy_manual'
      ORDER BY req.created_at ASC
    ) r
  );
END;
$$;


ALTER FUNCTION "public"."get_pending_topup_requests_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  RETURN v_email;
END;
$$;


ALTER FUNCTION "public"."get_user_email"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("target_group_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.group_members WHERE group_id = target_group_id AND user_id = auth.uid() AND status = 'member' LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"("target_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_company_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.mcredit_wallets (owner_type, owner_id, balance, status)
  VALUES ('company', NEW.id, 0.00, 'active')
  ON CONFLICT (owner_id) WHERE (owner_type = 'company') DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_company_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_group_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'member');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_group_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_profile_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.mcredit_wallets (owner_type, owner_id, balance, status)
  VALUES ('user', NEW.id, 0.00, 'active')
  ON CONFLICT (owner_id) WHERE (owner_type = 'user') DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_profile_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New Member'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y')
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_admin_permission"("p_user_id" "uuid", "p_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 BEGIN
   -- 1. Check legacy profiles.global_role fallback
   IF EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = p_user_id AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
   ) THEN
     RETURN TRUE;
   END IF;

   -- 2. Check platform admin user roles with specific permission
   RETURN EXISTS (
     SELECT 1
     FROM public.platform_admin_user_roles ur
     JOIN public.platform_admin_roles r ON r.id = ur.role_id
     JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
     JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = p_user_id
       AND ur.is_active = true
       AND p.permission_key = p_permission
   );
 END;
 $$;


ALTER FUNCTION "public"."has_admin_permission"("p_user_id" "uuid", "p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 BEGIN
   RETURN EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = p_user_id AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
   ) OR EXISTS (
     SELECT 1
     FROM public.platform_admin_user_roles ur
     JOIN public.platform_admin_roles r ON r.id = ur.role_id
     JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
     JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = p_user_id
       AND ur.is_active = true
       AND p.permission_key IN (
         'can_view_wallet_control',
         'can_grant_mcredits',
         'can_deduct_mcredits',
         'can_approve_topups',
         'can_reject_topups',
         'can_view_platform_wallet',
         'can_view_finance_reports'
       )
   );
 END;
 $$;


ALTER FUNCTION "public"."is_admin_user"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin_user"("p_user_id" "uuid") IS 'Checks if a user is an admin via legacy global_role or active platform_admin_user_roles with wallet/finance permissions. Runs as SECURITY DEFINER to avoid RLS recursion.';



CREATE OR REPLACE FUNCTION "public"."is_group_member"("target_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND user_id = auth.uid() AND status = 'member');
$$;


ALTER FUNCTION "public"."is_group_member"("target_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_group_message_attachment_ready"("p_attachment_id" "uuid", "p_actual_mime_type" "text", "p_actual_byte_size" bigint, "p_content_sha256" "text", "p_inspection_metadata" "jsonb", "p_inspector" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'storage'
    AS $_$
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
end $_$;


ALTER FUNCTION "public"."mark_group_message_attachment_ready"("p_attachment_id" "uuid", "p_actual_mime_type" "text", "p_actual_byte_size" bigint, "p_content_sha256" "text", "p_inspection_metadata" "jsonb", "p_inspector" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_group_thread_message"("p_message_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."publish_group_thread_message"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_group_thread_message"("p_message_id" "uuid", "p_thread_id" "uuid", "p_content" "text", "p_attachments" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
        when 'application/msword' then 'doc'
        when 'application/vnd.ms-excel' then 'xls'
        when 'application/vnd.ms-powerpoint' then 'ppt'
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


ALTER FUNCTION "public"."reserve_group_thread_message"("p_message_id" "uuid", "p_thread_id" "uuid", "p_content" "text", "p_attachments" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_platform_admin_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_platform_admin_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_group_message"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."soft_delete_group_message"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_group_message_attachment"("p_attachment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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


ALTER FUNCTION "public"."soft_delete_group_message_attachment"("p_attachment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_role_permissions"("p_role_id" "uuid", "p_permission_keys" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role_key text;
  v_permission_ids uuid[];
BEGIN
  -- Security check: allow service_role bypass or require can_manage_admin_roles / admin status
  IF auth.role() <> 'service_role' AND NOT (
    public.current_user_has_platform_admin_permission('can_manage_admin_roles')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND global_role IN ('super_admin', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Missing permission can_manage_admin_roles';
  END IF;

  -- 1. Check if the role exists and get its key
  SELECT role_key INTO v_role_key
  FROM public.platform_admin_roles
  WHERE id = p_role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- 2. Reject editing super_admin
  IF v_role_key = 'super_admin' THEN
    RAISE EXCEPTION 'System protected role: super_admin permissions cannot be modified.';
  END IF;

  -- 3. Resolve permission keys to IDs
  -- Ensure that if an empty array is passed, it clears the role correctly.
  IF array_length(p_permission_keys, 1) > 0 THEN
    SELECT array_agg(id) INTO v_permission_ids
    FROM public.platform_admin_permissions
    WHERE permission_key = ANY(p_permission_keys);

    -- Ensure we don't proceed with null if keys were provided but none matched.
    IF v_permission_ids IS NULL THEN
      RAISE EXCEPTION 'None of the provided permission keys were found in the database.';
    END IF;
  ELSE
    v_permission_ids := ARRAY[]::uuid[];
  END IF;

  -- 4. Sync: Delete existing permissions for this role
  DELETE FROM public.platform_admin_role_permissions
  WHERE role_id = p_role_id;

  -- 5. Sync: Insert new permissions
  IF array_length(v_permission_ids, 1) > 0 THEN
    INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
    SELECT p_role_id, unnest(v_permission_ids);
  END IF;

END;
$$;


ALTER FUNCTION "public"."sync_role_permissions"("p_role_id" "uuid", "p_permission_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_app_thread_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.application_threads
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_app_thread_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_friendships_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_friendships_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."application_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."application_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."application_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "poster_user_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "applicant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."application_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text",
    "applied_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "documents" "jsonb" DEFAULT '[]'::"jsonb",
    "withdrawal_count" integer DEFAULT 0,
    "offer_sent_at" timestamp with time zone,
    "offer_expires_at" timestamp with time zone,
    "offer_expiry_hours" integer
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_reputation_summary" (
    "candidate_id" "uuid" NOT NULL,
    "completed_jobs" integer DEFAULT 0,
    "cancelled_jobs" integer DEFAULT 0,
    "excused_cancellations" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completion_rate" numeric DEFAULT 0,
    "feedback_count" integer DEFAULT 0,
    "positive_feedback_count" integer DEFAULT 0,
    "negative_feedback_count" integer DEFAULT 0
);


ALTER TABLE "public"."candidate_reputation_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_content_variables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variable_key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_public" boolean DEFAULT true
);


ALTER TABLE "public"."cms_content_variables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_faqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid",
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cms_faqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_page_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "section_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cms_page_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "meta_description" "text",
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cms_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "authorName" "text",
    "authorRole" "text",
    "parent_id" "uuid"
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "website" "text",
    "industry" "text",
    "location" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "profile_id" "uuid",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "company_members_role_check" CHECK (("role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text", 'Member'::"text"])))
);


ALTER TABLE "public"."company_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_one" "uuid",
    "participant_two" "uuid",
    "context_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text",
    "start_date" "date",
    "end_date" "date",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."experience" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "accepted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_no_self_friending" CHECK (("requester_id" <> "recipient_id")),
    CONSTRAINT "friendships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" "text" DEFAULT 'marcomn_master_config'::"text" NOT NULL,
    "company_name" "text" DEFAULT 'MarComn'::"text" NOT NULL,
    "company_logo_url" "text",
    "brand_slogan" "text" DEFAULT 'The Professional Maritime Network'::"text",
    "messaging_cooldown_seconds" integer DEFAULT 5 NOT NULL,
    "is_maintenance_mode" boolean DEFAULT false NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "single_row_lock" CHECK (("id" = 'marcomn_master_config'::"text"))
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_attachment_cleanup_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attachment_id" "uuid",
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "reason" "public"."group_attachment_cleanup_reason" NOT NULL,
    "eligible_at" timestamp with time zone NOT NULL,
    "status" "public"."group_attachment_cleanup_status" DEFAULT 'pending'::"public"."group_attachment_cleanup_status" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone NOT NULL,
    "claimed_at" timestamp with time zone,
    "claimed_by" "text",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_attachment_cleanup_queue_claimed_by_check" CHECK ((("claimed_by" IS NULL) OR ("char_length"("claimed_by") <= 200))),
    CONSTRAINT "group_attachment_cleanup_queue_last_error_check" CHECK ((("last_error" IS NULL) OR ("char_length"("last_error") <= 4000))),
    CONSTRAINT "group_attachment_cleanup_queue_retry_count_check" CHECK (("retry_count" >= 0)),
    CONSTRAINT "group_attachment_cleanup_queue_storage_bucket_check" CHECK (("storage_bucket" = 'group-message-attachments'::"text")),
    CONSTRAINT "group_attachment_cleanup_queue_storage_path_check" CHECK (("char_length"("storage_path") <= 1024))
);


ALTER TABLE "public"."group_attachment_cleanup_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_attachment_cleanup_queue" IS 'Discovery queue only. claim_group_attachment_cleanup must revalidate before every physical deletion.';



CREATE TABLE IF NOT EXISTS "public"."group_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid"
);


ALTER TABLE "public"."group_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_legacy_mirror_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "public"."group_legacy_mirror_status" DEFAULT 'pending'::"public"."group_legacy_mirror_status" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "claimed_by" "text",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_legacy_mirror_outbox_claimed_by_check" CHECK ((("claimed_by" IS NULL) OR ("char_length"("claimed_by") <= 200))),
    CONSTRAINT "group_legacy_mirror_outbox_last_error_check" CHECK ((("last_error" IS NULL) OR ("char_length"("last_error") <= 4000))),
    CONSTRAINT "group_legacy_mirror_outbox_payload_check" CHECK (("octet_length"(("payload")::"text") <= 32768)),
    CONSTRAINT "group_legacy_mirror_outbox_retry_count_check" CHECK (("retry_count" >= 0))
);


ALTER TABLE "public"."group_legacy_mirror_outbox" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_legacy_mirror_outbox" IS 'Idempotent compatibility mirror work keyed by canonical message_id; service workers claim with SKIP LOCKED.';



CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'moderator'::"text", 'admin'::"text"]))),
    CONSTRAINT "group_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'member'::"text", 'banned'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "attachment_type" "public"."group_message_attachment_type" NOT NULL,
    "storage_bucket" "text",
    "storage_path" "text",
    "original_filename" "text",
    "mime_type" "text",
    "byte_size" bigint,
    "external_url" "text",
    "title" "text",
    "preview_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actual_mime_type" "text",
    "actual_byte_size" bigint,
    "content_sha256" "text",
    "inspection_metadata" "jsonb",
    "inspected_at" timestamp with time zone,
    "inspected_by" "text",
    "sort_order" smallint NOT NULL,
    "status" "public"."group_message_attachment_status" DEFAULT 'pending'::"public"."group_message_attachment_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "group_message_attachments_actual_size" CHECK ((("actual_byte_size" IS NULL) OR (("actual_byte_size" >= 1) AND ("actual_byte_size" <= 26214400)))),
    CONSTRAINT "group_message_attachments_delete_pair" CHECK (((("deleted_at" IS NULL) AND ("deleted_by" IS NULL)) OR ("deleted_at" IS NOT NULL))),
    CONSTRAINT "group_message_attachments_image_size" CHECK ((("attachment_type" <> 'image'::"public"."group_message_attachment_type") OR ("byte_size" <= 10485760))),
    CONSTRAINT "group_message_attachments_inspection_shape" CHECK ((("inspection_metadata" IS NULL) OR (("jsonb_typeof"("inspection_metadata") = 'object'::"text") AND ("octet_length"(("inspection_metadata")::"text") <= 16384) AND ("jsonb_array_length"("jsonb_path_query_array"("inspection_metadata", '$.**'::"jsonpath")) <= 100)))),
    CONSTRAINT "group_message_attachments_inspector_length" CHECK ((("inspected_by" IS NULL) OR (("char_length"("inspected_by") >= 1) AND ("char_length"("inspected_by") <= 200)))),
    CONSTRAINT "group_message_attachments_mime" CHECK ((("attachment_type" <> ALL (ARRAY['image'::"public"."group_message_attachment_type", 'document'::"public"."group_message_attachment_type"])) OR ("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'application/pdf'::"text", 'application/msword'::"text", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::"text", 'application/vnd.ms-excel'::"text", 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::"text", 'application/vnd.ms-powerpoint'::"text", 'application/vnd.openxmlformats-officedocument.presentationml.presentation'::"text", 'text/plain'::"text"])))),
    CONSTRAINT "group_message_attachments_phase_13c_allowlist_check" CHECK (((("attachment_type" = 'image'::"public"."group_message_attachment_type") AND ((("mime_type" = 'image/jpeg'::"text") AND ("original_filename" ~* '\.jpe?g$'::"text")) OR (("mime_type" = 'image/png'::"text") AND ("original_filename" ~* '\.png$'::"text")) OR (("mime_type" = 'image/webp'::"text") AND ("original_filename" ~* '\.webp$'::"text")))) OR (("attachment_type" = 'document'::"public"."group_message_attachment_type") AND ((("mime_type" = 'application/pdf'::"text") AND ("original_filename" ~* '\.pdf$'::"text")) OR (("mime_type" = 'application/msword'::"text") AND ("original_filename" ~* '\.doc$'::"text")) OR (("mime_type" = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::"text") AND ("original_filename" ~* '\.docx$'::"text")) OR (("mime_type" = 'application/vnd.ms-excel'::"text") AND ("original_filename" ~* '\.xls$'::"text")) OR (("mime_type" = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::"text") AND ("original_filename" ~* '\.xlsx$'::"text")) OR (("mime_type" = 'application/vnd.ms-powerpoint'::"text") AND ("original_filename" ~* '\.ppt$'::"text")) OR (("mime_type" = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'::"text") AND ("original_filename" ~* '\.pptx$'::"text")) OR (("mime_type" = 'text/plain'::"text") AND ("original_filename" ~* '\.txt$'::"text")))) OR (("attachment_type" = ANY (ARRAY['youtube'::"public"."group_message_attachment_type", 'vimeo'::"public"."group_message_attachment_type"])) AND ("mime_type" IS NULL)))),
    CONSTRAINT "group_message_attachments_preview_object" CHECK ((("jsonb_typeof"("preview_metadata") = 'object'::"text") AND ("jsonb_array_length"("jsonb_path_query_array"("preview_metadata", '$.**'::"jsonpath")) <= 100))),
    CONSTRAINT "group_message_attachments_ready_evidence" CHECK ((("status" <> 'ready'::"public"."group_message_attachment_status") OR (("inspection_metadata" IS NOT NULL) AND ("inspected_at" IS NOT NULL) AND ("inspected_by" IS NOT NULL) AND (("char_length"("inspected_by") >= 1) AND ("char_length"("inspected_by") <= 200)) AND (("inspection_metadata" ->> 'safe'::"text") IS NOT NULL) AND (("inspection_metadata" ->> 'safe'::"text") = 'true'::"text") AND ((("attachment_type" = ANY (ARRAY['image'::"public"."group_message_attachment_type", 'document'::"public"."group_message_attachment_type"])) AND ("actual_mime_type" IS NOT NULL) AND ("actual_byte_size" IS NOT NULL) AND ("content_sha256" IS NOT NULL) AND ("actual_mime_type" = "mime_type") AND ("actual_byte_size" = "byte_size") AND (("inspection_metadata" ->> 'magic_bytes_valid'::"text") IS NOT NULL) AND (("inspection_metadata" ->> 'magic_bytes_valid'::"text") = 'true'::"text") AND (("mime_type" !~~ 'application/vnd.openxmlformats-officedocument.%'::"text") OR ((("inspection_metadata" ->> 'office_container_valid'::"text") IS NOT NULL) AND (("inspection_metadata" ->> 'office_container_valid'::"text") = 'true'::"text")))) OR (("attachment_type" = ANY (ARRAY['external_link'::"public"."group_message_attachment_type", 'youtube'::"public"."group_message_attachment_type", 'vimeo'::"public"."group_message_attachment_type"])) AND ("actual_mime_type" IS NULL) AND ("actual_byte_size" IS NULL) AND ("content_sha256" IS NULL) AND (("inspection_metadata" ->> 'canonical_url'::"text") IS NOT NULL) AND (("inspection_metadata" ->> 'canonical_url'::"text") = "external_url") AND (("inspection_metadata" ->> 'ssrf_safe'::"text") IS NOT NULL) AND (("inspection_metadata" ->> 'ssrf_safe'::"text") = 'true'::"text")))))),
    CONSTRAINT "group_message_attachments_sha256" CHECK ((("content_sha256" IS NULL) OR ("content_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "group_message_attachments_shape" CHECK (((("attachment_type" = ANY (ARRAY['image'::"public"."group_message_attachment_type", 'document'::"public"."group_message_attachment_type"])) AND ("storage_bucket" = 'group-message-attachments'::"text") AND (NULLIF("storage_path", ''::"text") IS NOT NULL) AND (NULLIF("original_filename", ''::"text") IS NOT NULL) AND (NULLIF("mime_type", ''::"text") IS NOT NULL) AND ("byte_size" IS NOT NULL) AND ("external_url" IS NULL)) OR (("attachment_type" = ANY (ARRAY['external_link'::"public"."group_message_attachment_type", 'youtube'::"public"."group_message_attachment_type", 'vimeo'::"public"."group_message_attachment_type"])) AND ("storage_bucket" IS NULL) AND ("storage_path" IS NULL) AND ("original_filename" IS NULL) AND ("mime_type" IS NULL) AND ("byte_size" IS NULL) AND ("external_url" ~* '^https://[^[:space:]]+$'::"text")))),
    CONSTRAINT "group_message_attachments_size" CHECK ((("byte_size" IS NULL) OR (("byte_size" >= 1) AND ("byte_size" <= 26214400)))),
    CONSTRAINT "group_message_attachments_sort_order" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 4))),
    CONSTRAINT "group_message_attachments_text_limits" CHECK (((("original_filename" IS NULL) OR (("char_length"("original_filename") >= 1) AND ("char_length"("original_filename") <= 255))) AND (("title" IS NULL) OR ("char_length"("title") <= 300)) AND (("external_url" IS NULL) OR ("char_length"("external_url") <= 2048)) AND (("storage_path" IS NULL) OR ("char_length"("storage_path") <= 1024)) AND ("octet_length"(("preview_metadata")::"text") <= 16384))),
    CONSTRAINT "group_message_attachments_video_host" CHECK ((("attachment_type" <> ALL (ARRAY['youtube'::"public"."group_message_attachment_type", 'vimeo'::"public"."group_message_attachment_type"])) OR (("attachment_type" = 'youtube'::"public"."group_message_attachment_type") AND ("external_url" ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be)([/:?#]|$)'::"text")) OR (("attachment_type" = 'vimeo'::"public"."group_message_attachment_type") AND ("external_url" ~* '^https://([a-z0-9-]+\.)?vimeo\.com([/:?#]|$)'::"text"))))
);


ALTER TABLE "public"."group_message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_message_reservation_cleanup_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "eligible_at" timestamp with time zone NOT NULL,
    "status" "public"."group_attachment_cleanup_status" DEFAULT 'pending'::"public"."group_attachment_cleanup_status" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone NOT NULL,
    "claimed_at" timestamp with time zone,
    "claimed_by" "text",
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_message_reservation_cleanup_queue_claimed_by_check" CHECK ((("claimed_by" IS NULL) OR ("char_length"("claimed_by") <= 200))),
    CONSTRAINT "group_message_reservation_cleanup_queue_last_error_check" CHECK ((("last_error" IS NULL) OR ("char_length"("last_error") <= 4000))),
    CONSTRAINT "group_message_reservation_cleanup_queue_retry_count_check" CHECK (("retry_count" >= 0))
);


ALTER TABLE "public"."group_message_reservation_cleanup_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_message_reservation_cleanup_queue" IS 'Hidden draft/cancelled reservation cleanup queue; workers must revalidate delivery_status under lock.';



CREATE TABLE IF NOT EXISTS "public"."group_post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "file_urls" "jsonb"
);


ALTER TABLE "public"."group_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_thread_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "reply_to_message_id" "uuid",
    "reply_author_name" "text",
    "reply_preview" "text",
    "delivery_status" "text" DEFAULT 'published'::"text" NOT NULL,
    "reservation_request" "jsonb",
    CONSTRAINT "group_thread_messages_content_length_check" CHECK (("char_length"("content") <= 10000)),
    CONSTRAINT "group_thread_messages_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "group_thread_messages_reservation_request_check" CHECK (((("delivery_status" = 'draft'::"text") AND ("reservation_request" IS NOT NULL) AND ("jsonb_typeof"("reservation_request") = 'object'::"text") AND ("octet_length"(("reservation_request")::"text") <= 32768)) OR ("delivery_status" = ANY (ARRAY['published'::"text", 'cancelled'::"text"]))))
);


ALTER TABLE "public"."group_thread_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."group_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'public'::"text",
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    CONSTRAINT "groups_type_check" CHECK (("type" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_advance_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "job_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "previous_status" "text",
    "new_status" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_advance_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_advance_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "job_order_id" "uuid",
    "applicant_id" "uuid" NOT NULL,
    "requested_amount" numeric(10,2) NOT NULL,
    "counter_amount" numeric(10,2) DEFAULT NULL::numeric,
    "approved_amount" numeric(10,2) DEFAULT NULL::numeric,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "transfer_date" "date",
    "reference_number" "text",
    "company_notes" "text",
    "applicant_notes" "text",
    "dispute_reason" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "negotiated_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "proof_url" "text",
    CONSTRAINT "chk_advance_payment_method" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['bank_transfer'::"text", 'wise'::"text", 'paypal'::"text", 'gcash'::"text", 'paynow'::"text", 'cash'::"text", 'other'::"text"])))),
    CONSTRAINT "chk_advance_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'countered'::"text", 'approved'::"text", 'transfer_recorded'::"text", 'confirmed'::"text", 'rejected'::"text", 'disputed'::"text", 'cancelled'::"text", 'expired'::"text", 'review_closed'::"text"]))),
    CONSTRAINT "chk_requested_amount_positive" CHECK (("requested_amount" > (0)::numeric))
);


ALTER TABLE "public"."job_advance_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_cancellations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_order_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "cancelled_by" "uuid" NOT NULL,
    "cancelled_by_type" "text" DEFAULT 'candidate'::"text" NOT NULL,
    "cancellation_reason" "text" NOT NULL,
    "cancellation_remarks" "text",
    "cancellation_status" "text" DEFAULT 'Normal'::"text" NOT NULL,
    "is_excused" boolean DEFAULT false NOT NULL,
    "excused_by" "uuid",
    "excused_at" timestamp with time zone,
    "excused_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cancellation_category" "text",
    "refund_status" "text" DEFAULT 'not_applicable'::"text",
    "refund_review_required" boolean DEFAULT false,
    "refund_processed_at" timestamp with time zone,
    "refund_transaction_id" "uuid",
    "company_compensation_transaction_id" "uuid",
    "platform_revenue_transaction_id" "uuid"
);


ALTER TABLE "public"."job_cancellations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job_cancellations"."cancellation_category" IS 'company_business | applicant_fault | candidate_cancelled';



COMMENT ON COLUMN "public"."job_cancellations"."refund_status" IS 'not_applicable | auto_refunded | pending_review | approved | rejected';



CREATE TABLE IF NOT EXISTS "public"."job_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_order_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "candidate_id" "uuid" NOT NULL,
    "feedback_by" "uuid" NOT NULL,
    "feedback_context" "text" NOT NULL,
    "feedback_tags" "text"[],
    "feedback_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "feedback_sentiment" "text"
);


ALTER TABLE "public"."job_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "candidate_id" "uuid" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "work_completed_by_applicant_at" timestamp with time zone,
    "completion_confirmed_by_company_at" timestamp with time zone,
    "payment_confirmed_by_applicant_at" timestamp with time zone,
    "engagement_closed_at" timestamp with time zone,
    "work_completion_note" "text",
    "company_completion_note" "text",
    "payment_confirmation_note" "text"
);


ALTER TABLE "public"."job_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "location" "text",
    "salary_range" "text",
    "employment_type" "text" DEFAULT 'Full-time'::"text",
    "status" "text" DEFAULT 'Open'::"text",
    "company_id" "uuid",
    "poster_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "required_skills" "text"[],
    "priority" boolean DEFAULT false,
    "responsibilities" "text",
    "withdrawal_limit" integer DEFAULT 3,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "salary_numeric" numeric(12,2),
    "experience_level" "text" DEFAULT 'Mid'::"text",
    "advance_payment_enabled" boolean DEFAULT false,
    "advance_payment_type" "text",
    "advance_payment_value" numeric(10,2) DEFAULT NULL::numeric,
    "advance_payment_max" numeric(10,2) DEFAULT NULL::numeric,
    "advance_payment_allow_multiple" boolean DEFAULT false,
    "advance_payment_notes" "text",
    "advance_payment_availability" "text" DEFAULT 'shortlisted'::"text",
    "advance_payment_expiry_days" integer,
    "number_of_positions" integer DEFAULT 1 NOT NULL,
    "pay_rate_quantity" numeric,
    CONSTRAINT "chk_advance_max_salary" CHECK ((("advance_payment_max" IS NULL) OR ("salary_numeric" IS NULL) OR ("advance_payment_max" <= "salary_numeric"))),
    CONSTRAINT "chk_advance_payment_availability" CHECK (("advance_payment_availability" = ANY (ARRAY['shortlisted'::"text", 'offered'::"text", 'accepted'::"text"]))),
    CONSTRAINT "chk_advance_payment_expiry_days" CHECK ((("advance_payment_expiry_days" IS NULL) OR ("advance_payment_expiry_days" > 0))),
    CONSTRAINT "chk_advance_payment_type" CHECK ((("advance_payment_type" IS NULL) OR ("advance_payment_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text"])))),
    CONSTRAINT "jobs_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['Entry Level'::"text", 'Junior'::"text", 'Mid'::"text", 'Senior'::"text", 'Specialist'::"text", 'Expert'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."jobs_search_view" WITH ("security_invoker"='on') AS
 SELECT "j"."id",
    "j"."title",
    "j"."description",
    "j"."location",
    "j"."salary_range",
    "j"."employment_type",
    "j"."status",
    "j"."company_id",
    "j"."poster_id",
    "j"."created_at",
    "j"."required_skills",
    "j"."priority",
    "j"."responsibilities",
    "j"."withdrawal_limit",
    "j"."tags",
    "j"."salary_numeric",
    "j"."experience_level",
    "j"."advance_payment_enabled",
    "j"."advance_payment_type",
    "j"."advance_payment_value",
    "j"."advance_payment_max",
    "j"."advance_payment_allow_multiple",
    "j"."advance_payment_notes",
    "j"."advance_payment_availability",
    "j"."advance_payment_expiry_days",
    "j"."number_of_positions",
    "j"."pay_rate_quantity",
    "c"."name" AS "company_name",
    "array_to_string"("j"."required_skills", ' '::"text") AS "skills_text",
    "array_to_string"("j"."tags", ' '::"text") AS "tags_text",
    COALESCE(( SELECT ("count"(*))::integer AS "count"
           FROM "public"."applications" "a"
          WHERE (("a"."job_id" = "j"."id") AND ("a"."status" = ANY (ARRAY['Accepted'::"text", 'Completed'::"text"])))), 0) AS "filled_positions"
   FROM ("public"."jobs" "j"
     LEFT JOIN "public"."companies" "c" ON (("j"."company_id" = "c"."id")));


ALTER VIEW "public"."jobs_search_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "comment_id" "uuid"
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."likes"."comment_id" IS 'Reference to the comment being liked, if applicable.';



CREATE TABLE IF NOT EXISTS "public"."logbook_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "media_url" "text",
    "media_type" "text" DEFAULT 'image'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "posted_as_company_id" "uuid",
    "group_id" "text",
    "file_url" "text",
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "file_urls" "text"[] DEFAULT '{}'::"text"[],
    "shared_article_id" "uuid",
    "post_type" "text" DEFAULT 'quick'::"text",
    "video_url" "text",
    "excerpt" "text",
    "cover_media_url" "text",
    "embedded_media" "text",
    "author_id" "uuid"
);


ALTER TABLE "public"."logbook_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mblog_article_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mblog_article_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mblog_article_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mblog_article_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mblog_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content_html" "text" NOT NULL,
    "media_url" "text",
    "pdf_url" "text",
    "youtube_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mblog_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcredit_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_number" "text" NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "topup_request_id" "uuid",
    "transaction_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "payment_method" "text" DEFAULT 'dummy_manual'::"text",
    "payment_reference" "text",
    "status" "text" DEFAULT 'issued'::"text" NOT NULL,
    "issued_to_name" "text",
    "issued_to_email" "text",
    "issued_to_company_name" "text",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mcredit_receipts_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "mcredit_receipts_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['user'::"text", 'company'::"text"]))),
    CONSTRAINT "mcredit_receipts_status_check" CHECK (("status" = ANY (ARRAY['issued'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."mcredit_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcredit_refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "wallet_id" "uuid" NOT NULL,
    "topup_request_id" "uuid",
    "original_transaction_id" "uuid",
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "requested_mcredits" numeric NOT NULL,
    "max_refundable_mcredits_snapshot" numeric NOT NULL,
    "approved_mcredits" numeric,
    "gross_refund_amount" numeric,
    "fee_deduction_amount" numeric DEFAULT 0,
    "net_refund_amount" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "reason" "text" NOT NULL,
    "user_note" "text",
    "admin_note" "text",
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejected_at" timestamp with time zone,
    "stripe_refund_id" "text",
    "stripe_refund_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_approved_mcredits" CHECK ((("approved_mcredits" IS NULL) OR ("approved_mcredits" >= (0)::numeric))),
    CONSTRAINT "chk_fee_deduction_amount" CHECK (("fee_deduction_amount" >= (0)::numeric)),
    CONSTRAINT "chk_gross_refund_amount" CHECK ((("gross_refund_amount" IS NULL) OR ("gross_refund_amount" >= (0)::numeric))),
    CONSTRAINT "chk_max_refundable_mcredits_snapshot" CHECK (("max_refundable_mcredits_snapshot" >= (0)::numeric)),
    CONSTRAINT "chk_net_refund_amount" CHECK ((("net_refund_amount" IS NULL) OR ("net_refund_amount" >= (0)::numeric))),
    CONSTRAINT "chk_reason" CHECK (("reason" = ANY (ARRAY['unused_credits'::"text", 'duplicate_payment'::"text", 'technical_payment_issue'::"text", 'incorrect_crediting'::"text", 'unauthorized_charge_concern'::"text", 'other'::"text"]))),
    CONSTRAINT "chk_requested_mcredits" CHECK (("requested_mcredits" > (0)::numeric)),
    CONSTRAINT "chk_status" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'processing'::"text", 'refunded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."mcredit_refund_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcredit_topup_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "wallet_id" "uuid",
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'dummy_manual'::"text",
    "payment_reference" "text",
    "remarks" "text",
    "admin_notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejected_at" timestamp with time zone,
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mcredit_topup_requests_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "mcredit_topup_requests_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['user'::"text", 'company'::"text"]))),
    CONSTRAINT "mcredit_topup_requests_status_check" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'Approved'::"text", 'Rejected'::"text", 'Cancelled'::"text"])))
);


ALTER TABLE "public"."mcredit_topup_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcredit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "balance_before" numeric(12,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "description" "text",
    "justification_note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcredit_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "mcredit_transactions_direction_check" CHECK (("direction" = ANY (ARRAY['credit'::"text", 'debit'::"text"]))),
    CONSTRAINT "mcredit_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['admin_grant'::"text", 'admin_deduct'::"text", 'purchase_pending'::"text", 'purchase_completed'::"text", 'spend'::"text", 'refund'::"text", 'adjustment'::"text", 'penalty'::"text", 'platform_revenue'::"text"])))
);


ALTER TABLE "public"."mcredit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcredit_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid",
    "balance" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcredit_wallets_balance_check" CHECK (("balance" >= (0)::numeric)),
    CONSTRAINT "mcredit_wallets_owner_type_check" CHECK (("owner_type" = ANY (ARRAY['user'::"text", 'company'::"text", 'platform'::"text"]))),
    CONSTRAINT "mcredit_wallets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'frozen'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."mcredit_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "user_id" "uuid" NOT NULL,
    "social_enabled" boolean DEFAULT true NOT NULL,
    "connection_enabled" boolean DEFAULT true NOT NULL,
    "group_enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "messaging_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action_key" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admin_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "permission_key" "text" NOT NULL,
    "permission_name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admin_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admin_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admin_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admin_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_key" "text" NOT NULL,
    "role_name" "text" NOT NULL,
    "description" "text",
    "is_system_role" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admin_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_reason" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_admin_user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "username" "text",
    "name" "text",
    "avatar_url" "text",
    "website" "text",
    "headline" "text",
    "location" "text",
    "about" "text",
    "cover_photo_url" "text",
    "current_company" "text",
    "bio" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "previousRole" "text",
    "skills" "text"[],
    "isSailing" boolean DEFAULT false,
    "vesselName" "text",
    "openToWork" "text" DEFAULT false,
    "currentRole" "text",
    "yearsExperience" integer DEFAULT 0,
    "message_privacy" "text" DEFAULT 'connections'::"text",
    "global_role" "public"."platform_global_role" DEFAULT 'guest_user'::"public"."platform_global_role",
    "inbox_privacy" "text" DEFAULT 'public'::"text",
    CONSTRAINT "check_message_privacy" CHECK (("message_privacy" = ANY (ARRAY['connections'::"text", 'anyone'::"text"]))),
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_review_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_order_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "cancellation_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "case_type" "text" DEFAULT 'applicant_fault_company_cancellation'::"text" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "amount_pending" numeric(12,2),
    "reason" "text" NOT NULL,
    "remarks" "text",
    "admin_notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."refund_review_cases" OWNER TO "postgres";


COMMENT ON TABLE "public"."refund_review_cases" IS 'Holds cases requiring MarComn admin review for refund decisions';



COMMENT ON COLUMN "public"."refund_review_cases"."case_type" IS 'applicant_fault_company_cancellation | other';



COMMENT ON COLUMN "public"."refund_review_cases"."status" IS 'Pending | Approved | Rejected | Resolved';



CREATE TABLE IF NOT EXISTS "public"."thread_participants" (
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."thread_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_settings_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."user_notification_settings_archive" OWNER TO "postgres";


ALTER TABLE ONLY "public"."application_messages"
    ADD CONSTRAINT "application_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_application_id_key" UNIQUE ("application_id");



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_applicant_id_key" UNIQUE ("job_id", "applicant_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_reputation_summary"
    ADD CONSTRAINT "candidate_reputation_summary_pkey" PRIMARY KEY ("candidate_id");



ALTER TABLE ONLY "public"."cms_content_variables"
    ADD CONSTRAINT "cms_content_variables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_content_variables"
    ADD CONSTRAINT "cms_content_variables_variable_key_key" UNIQUE ("variable_key");



ALTER TABLE ONLY "public"."cms_faqs"
    ADD CONSTRAINT "cms_faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_page_sections"
    ADD CONSTRAINT "cms_page_sections_page_id_section_key_key" UNIQUE ("page_id", "section_key");



ALTER TABLE ONLY "public"."cms_page_sections"
    ADD CONSTRAINT "cms_page_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_pages"
    ADD CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_pages"
    ADD CONSTRAINT "cms_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_profile_id_key" UNIQUE ("company_id", "profile_id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experience"
    ADD CONSTRAINT "experience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_attachment_cleanup_queue"
    ADD CONSTRAINT "group_attachment_cleanup_queu_storage_bucket_storage_path_r_key" UNIQUE ("storage_bucket", "storage_path", "reason");



ALTER TABLE ONLY "public"."group_attachment_cleanup_queue"
    ADD CONSTRAINT "group_attachment_cleanup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_comments"
    ADD CONSTRAINT "group_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_legacy_mirror_outbox"
    ADD CONSTRAINT "group_legacy_mirror_outbox_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."group_legacy_mirror_outbox"
    ADD CONSTRAINT "group_legacy_mirror_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_message_id_id_key" UNIQUE ("message_id", "id");



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_message_id_sort_order_key" UNIQUE ("message_id", "sort_order");



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_storage_bucket_storage_path_key" UNIQUE ("storage_bucket", "storage_path");



ALTER TABLE ONLY "public"."group_message_reservation_cleanup_queue"
    ADD CONSTRAINT "group_message_reservation_cleanup_queue_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."group_message_reservation_cleanup_queue"
    ADD CONSTRAINT "group_message_reservation_cleanup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_post_likes"
    ADD CONSTRAINT "group_post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_post_likes"
    ADD CONSTRAINT "group_post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."group_posts"
    ADD CONSTRAINT "group_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_thread_messages"
    ADD CONSTRAINT "group_thread_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_threads"
    ADD CONSTRAINT "group_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_advance_audit_logs"
    ADD CONSTRAINT "job_advance_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_advance_requests"
    ADD CONSTRAINT "job_advance_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_application_id_key" UNIQUE ("application_id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."mblog_article_comments"
    ADD CONSTRAINT "mblog_article_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mblog_article_likes"
    ADD CONSTRAINT "mblog_article_likes_article_id_user_id_key" UNIQUE ("article_id", "user_id");



ALTER TABLE ONLY "public"."mblog_article_likes"
    ADD CONSTRAINT "mblog_article_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mblog_articles"
    ADD CONSTRAINT "mblog_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcredit_receipts"
    ADD CONSTRAINT "mcredit_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcredit_receipts"
    ADD CONSTRAINT "mcredit_receipts_receipt_number_key" UNIQUE ("receipt_number");



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcredit_transactions"
    ADD CONSTRAINT "mcredit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcredit_wallets"
    ADD CONSTRAINT "mcredit_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_audit_logs"
    ADD CONSTRAINT "platform_admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_permissions"
    ADD CONSTRAINT "platform_admin_permissions_permission_key_key" UNIQUE ("permission_key");



ALTER TABLE ONLY "public"."platform_admin_permissions"
    ADD CONSTRAINT "platform_admin_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_role_permissions"
    ADD CONSTRAINT "platform_admin_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_role_permissions"
    ADD CONSTRAINT "platform_admin_role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."platform_admin_roles"
    ADD CONSTRAINT "platform_admin_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_roles"
    ADD CONSTRAINT "platform_admin_roles_role_key_key" UNIQUE ("role_key");



ALTER TABLE ONLY "public"."platform_admin_user_roles"
    ADD CONSTRAINT "platform_admin_user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admin_user_roles"
    ADD CONSTRAINT "platform_admin_user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logbook_posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."refund_review_cases"
    ADD CONSTRAINT "refund_review_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("thread_id", "user_id");



ALTER TABLE ONLY "public"."user_notification_settings_archive"
    ADD CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_settings_archive"
    ADD CONSTRAINT "user_notification_settings_user_id_event_type_key" UNIQUE ("user_id", "event_type");



CREATE INDEX "group_attachment_cleanup_claim_idx" ON "public"."group_attachment_cleanup_queue" USING "btree" ("next_attempt_at", "eligible_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."group_attachment_cleanup_status", 'failed'::"public"."group_attachment_cleanup_status"]));



CREATE INDEX "group_legacy_mirror_claim_idx" ON "public"."group_legacy_mirror_outbox" USING "btree" ("next_attempt_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."group_legacy_mirror_status", 'failed'::"public"."group_legacy_mirror_status"]));



CREATE INDEX "group_message_attachments_active_message_idx" ON "public"."group_message_attachments" USING "btree" ("message_id", "sort_order") WHERE ("deleted_at" IS NULL);



CREATE INDEX "group_message_attachments_active_scope_idx" ON "public"."group_message_attachments" USING "btree" ("group_id", "thread_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "group_message_attachments_cleanup_idx" ON "public"."group_message_attachments" USING "btree" ("status", "created_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "group_message_attachments_retention_idx" ON "public"."group_message_attachments" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "group_message_attachments_shared_files_idx" ON "public"."group_message_attachments" USING "btree" ("group_id", "created_at" DESC) WHERE (("status" = 'ready'::"public"."group_message_attachment_status") AND ("deleted_at" IS NULL));



CREATE INDEX "group_message_reservation_cleanup_claim_idx" ON "public"."group_message_reservation_cleanup_queue" USING "btree" ("next_attempt_at", "eligible_at", "created_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."group_attachment_cleanup_status", 'failed'::"public"."group_attachment_cleanup_status"]));



CREATE INDEX "group_thread_messages_published_thread_idx" ON "public"."group_thread_messages" USING "btree" ("thread_id", "created_at") WHERE (("delivery_status" = 'published'::"text") AND (NOT "is_deleted"));



CREATE INDEX "group_thread_messages_stale_draft_idx" ON "public"."group_thread_messages" USING "btree" ("created_at") WHERE ("delivery_status" = ANY (ARRAY['draft'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_advance_audit_req" ON "public"."job_advance_audit_logs" USING "btree" ("request_id");



CREATE INDEX "idx_advance_req_application" ON "public"."job_advance_requests" USING "btree" ("application_id");



CREATE INDEX "idx_advance_req_order" ON "public"."job_advance_requests" USING "btree" ("job_order_id");



CREATE INDEX "idx_advance_req_status" ON "public"."job_advance_requests" USING "btree" ("status");



CREATE INDEX "idx_group_comments_post" ON "public"."group_comments" USING "btree" ("post_id");



CREATE INDEX "idx_group_members_group_user" ON "public"."group_members" USING "btree" ("group_id", "user_id");



CREATE INDEX "idx_group_posts_group" ON "public"."group_posts" USING "btree" ("group_id");



CREATE INDEX "idx_group_threads_group_id_last_msg" ON "public"."group_threads" USING "btree" ("group_id", "last_message_at" DESC);



CREATE INDEX "idx_mcredit_refunds_company_id" ON "public"."mcredit_refund_requests" USING "btree" ("company_id");



CREATE INDEX "idx_mcredit_refunds_created_at" ON "public"."mcredit_refund_requests" USING "btree" ("created_at");



CREATE INDEX "idx_mcredit_refunds_status" ON "public"."mcredit_refund_requests" USING "btree" ("status");



CREATE INDEX "idx_mcredit_refunds_stripe_pi_id" ON "public"."mcredit_refund_requests" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_mcredit_refunds_stripe_refund_id" ON "public"."mcredit_refund_requests" USING "btree" ("stripe_refund_id");



CREATE INDEX "idx_mcredit_refunds_topup_request_id" ON "public"."mcredit_refund_requests" USING "btree" ("topup_request_id");



CREATE INDEX "idx_mcredit_refunds_user_id" ON "public"."mcredit_refund_requests" USING "btree" ("user_id");



CREATE INDEX "idx_mcredit_refunds_wallet_id" ON "public"."mcredit_refund_requests" USING "btree" ("wallet_id");



CREATE INDEX "idx_posts_group_id" ON "public"."logbook_posts" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "idx_thread_messages_thread_id_created" ON "public"."group_thread_messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "idx_thread_participants_user_id" ON "public"."thread_participants" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_unique_mcredit_transaction_ref" ON "public"."mcredit_transactions" USING "btree" ("reference_type", "reference_id") WHERE ("reference_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_active_mcredit_refund_per_topup" ON "public"."mcredit_refund_requests" USING "btree" ("topup_request_id") WHERE (("topup_request_id" IS NOT NULL) AND ("status" = ANY (ARRAY['pending_review'::"text", 'processing'::"text"])));



CREATE UNIQUE INDEX "unique_active_friendship" ON "public"."friendships" USING "btree" (LEAST("requester_id", "recipient_id"), GREATEST("requester_id", "recipient_id")) WHERE ("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"]));



CREATE UNIQUE INDEX "unique_company_wallet" ON "public"."mcredit_wallets" USING "btree" ("owner_id") WHERE ("owner_type" = 'company'::"text");



CREATE UNIQUE INDEX "unique_platform_wallet" ON "public"."mcredit_wallets" USING "btree" ("owner_type") WHERE ("owner_type" = 'platform'::"text");



CREATE UNIQUE INDEX "unique_user_wallet" ON "public"."mcredit_wallets" USING "btree" ("owner_id") WHERE ("owner_type" = 'user'::"text");



CREATE OR REPLACE TRIGGER "enforce_application_messaging_status" BEFORE INSERT ON "public"."application_messages" FOR EACH ROW EXECUTE FUNCTION "public"."check_application_messaging_status"();



CREATE OR REPLACE TRIGGER "group_message_attachments_limit" BEFORE INSERT OR UPDATE OF "message_id", "deleted_at" ON "public"."group_message_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_group_message_attachment_limit"();



CREATE OR REPLACE TRIGGER "group_message_attachments_relationship" BEFORE INSERT OR UPDATE OF "message_id", "thread_id", "group_id" ON "public"."group_message_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_group_message_attachment_relationship"();



CREATE OR REPLACE TRIGGER "group_message_publication_cleanup_guard" BEFORE UPDATE OF "delivery_status" ON "public"."group_thread_messages" FOR EACH ROW EXECUTE FUNCTION "group_attachments_private"."guard_message_publication_cleanup"();



CREATE OR REPLACE TRIGGER "group_thread_messages_delivery_transition" BEFORE INSERT OR UPDATE OF "delivery_status" ON "public"."group_thread_messages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_group_thread_message_delivery_transition"();



CREATE OR REPLACE TRIGGER "on_group_created" AFTER INSERT ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_group_admin"();



CREATE OR REPLACE TRIGGER "set_platform_admin_roles_updated_at" BEFORE UPDATE ON "public"."platform_admin_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_platform_admin_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_admin_user_roles_updated_at" BEFORE UPDATE ON "public"."platform_admin_user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_platform_admin_updated_at"();



CREATE OR REPLACE TRIGGER "tr_check_conversation_permissions" BEFORE INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."check_conversation_permissions"();



CREATE OR REPLACE TRIGGER "tr_check_message_permissions" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."check_message_permissions"();



CREATE OR REPLACE TRIGGER "tr_friendships_updated_at" BEFORE UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."update_friendships_updated_at"();



CREATE OR REPLACE TRIGGER "tr_mcredit_receipts_updated_at" BEFORE UPDATE ON "public"."mcredit_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_on_company_created" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_company_wallet"();



CREATE OR REPLACE TRIGGER "tr_on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_profile_wallet"();



CREATE OR REPLACE TRIGGER "trg_check_job_compensation_immutable" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."check_job_compensation_immutable"();



CREATE OR REPLACE TRIGGER "update_app_thread_timestamp" AFTER INSERT ON "public"."application_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_app_thread_last_message"();



CREATE OR REPLACE TRIGGER "update_cms_content_variables_updated_at" BEFORE UPDATE ON "public"."cms_content_variables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cms_faqs_updated_at" BEFORE UPDATE ON "public"."cms_faqs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cms_page_sections_updated_at" BEFORE UPDATE ON "public"."cms_page_sections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cms_pages_updated_at" BEFORE UPDATE ON "public"."cms_pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcredit_refund_requests_updated_at" BEFORE UPDATE ON "public"."mcredit_refund_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_settings_modtime" BEFORE UPDATE ON "public"."notification_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."application_messages"
    ADD CONSTRAINT "application_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_messages"
    ADD CONSTRAINT "application_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."application_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_threads"
    ADD CONSTRAINT "application_threads_poster_user_id_fkey" FOREIGN KEY ("poster_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_reputation_summary"
    ADD CONSTRAINT "candidate_reputation_summary_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cms_faqs"
    ADD CONSTRAINT "cms_faqs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cms_page_sections"
    ADD CONSTRAINT "cms_page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."logbook_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_one_fkey" FOREIGN KEY ("participant_one") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_two_fkey" FOREIGN KEY ("participant_two") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience"
    ADD CONSTRAINT "experience_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_attachment_cleanup_queue"
    ADD CONSTRAINT "group_attachment_cleanup_queue_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "public"."group_message_attachments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_comments"
    ADD CONSTRAINT "group_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."group_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_comments"
    ADD CONSTRAINT "group_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_legacy_mirror_outbox"
    ADD CONSTRAINT "group_legacy_mirror_outbox_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_legacy_mirror_outbox"
    ADD CONSTRAINT "group_legacy_mirror_outbox_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_legacy_mirror_outbox"
    ADD CONSTRAINT "group_legacy_mirror_outbox_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."group_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."group_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_message_attachments"
    ADD CONSTRAINT "group_message_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_message_reservation_cleanup_queue"
    ADD CONSTRAINT "group_message_reservation_cleanup_queue_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_post_likes"
    ADD CONSTRAINT "group_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."group_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_post_likes"
    ADD CONSTRAINT "group_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_posts"
    ADD CONSTRAINT "group_posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_posts"
    ADD CONSTRAINT "group_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_thread_messages"
    ADD CONSTRAINT "group_thread_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."group_thread_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_thread_messages"
    ADD CONSTRAINT "group_thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."group_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_thread_messages"
    ADD CONSTRAINT "group_thread_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_threads"
    ADD CONSTRAINT "group_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_threads"
    ADD CONSTRAINT "group_threads_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_advance_audit_logs"
    ADD CONSTRAINT "job_advance_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_advance_audit_logs"
    ADD CONSTRAINT "job_advance_audit_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_advance_audit_logs"
    ADD CONSTRAINT "job_advance_audit_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."job_advance_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_advance_requests"
    ADD CONSTRAINT "job_advance_requests_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_advance_requests"
    ADD CONSTRAINT "job_advance_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_advance_requests"
    ADD CONSTRAINT "job_advance_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_advance_requests"
    ADD CONSTRAINT "job_advance_requests_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_excused_by_fkey" FOREIGN KEY ("excused_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_cancellations"
    ADD CONSTRAINT "job_cancellations_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_feedback_by_fkey" FOREIGN KEY ("feedback_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."job_feedback"
    ADD CONSTRAINT "job_feedback_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."job_orders"
    ADD CONSTRAINT "job_orders_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_poster_id_fkey" FOREIGN KEY ("poster_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."logbook_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logbook_posts"
    ADD CONSTRAINT "logbook_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mblog_article_comments"
    ADD CONSTRAINT "mblog_article_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."mblog_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mblog_article_comments"
    ADD CONSTRAINT "mblog_article_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mblog_article_likes"
    ADD CONSTRAINT "mblog_article_likes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."mblog_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mblog_article_likes"
    ADD CONSTRAINT "mblog_article_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mblog_articles"
    ADD CONSTRAINT "mblog_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcredit_receipts"
    ADD CONSTRAINT "mcredit_receipts_topup_request_id_fkey" FOREIGN KEY ("topup_request_id") REFERENCES "public"."mcredit_topup_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_receipts"
    ADD CONSTRAINT "mcredit_receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."mcredit_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_receipts"
    ADD CONSTRAINT "mcredit_receipts_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."mcredit_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_original_transaction_id_fkey" FOREIGN KEY ("original_transaction_id") REFERENCES "public"."mcredit_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_topup_request_id_fkey" FOREIGN KEY ("topup_request_id") REFERENCES "public"."mcredit_topup_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcredit_refund_requests"
    ADD CONSTRAINT "mcredit_refund_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."mcredit_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."mcredit_transactions"("id");



ALTER TABLE ONLY "public"."mcredit_topup_requests"
    ADD CONSTRAINT "mcredit_topup_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."mcredit_wallets"("id");



ALTER TABLE ONLY "public"."mcredit_transactions"
    ADD CONSTRAINT "mcredit_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mcredit_transactions"
    ADD CONSTRAINT "mcredit_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."mcredit_wallets"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."group_thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_admin_audit_logs"
    ADD CONSTRAINT "platform_admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."platform_admin_role_permissions"
    ADD CONSTRAINT "platform_admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."platform_admin_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admin_role_permissions"
    ADD CONSTRAINT "platform_admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."platform_admin_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admin_user_roles"
    ADD CONSTRAINT "platform_admin_user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."platform_admin_user_roles"
    ADD CONSTRAINT "platform_admin_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."platform_admin_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admin_user_roles"
    ADD CONSTRAINT "platform_admin_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logbook_posts"
    ADD CONSTRAINT "posts_posted_as_company_id_fkey" FOREIGN KEY ("posted_as_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logbook_posts"
    ADD CONSTRAINT "posts_shared_article_id_fkey" FOREIGN KEY ("shared_article_id") REFERENCES "public"."mblog_articles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logbook_posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_review_cases"
    ADD CONSTRAINT "refund_review_cases_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."refund_review_cases"
    ADD CONSTRAINT "refund_review_cases_cancellation_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "public"."job_cancellations"("id");



ALTER TABLE ONLY "public"."refund_review_cases"
    ADD CONSTRAINT "refund_review_cases_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."refund_review_cases"
    ADD CONSTRAINT "refund_review_cases_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "public"."job_orders"("id");



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."group_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_participants"
    ADD CONSTRAINT "thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_settings_archive"
    ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin CRUD all wallets" ON "public"."mcredit_wallets" TO "authenticated" USING ("public"."is_admin_user"("auth"."uid"())) WITH CHECK ("public"."is_admin_user"("auth"."uid"()));



CREATE POLICY "Admin Update platform_settings" ON "public"."platform_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."global_role")::"text" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'brand_manager'::"text", 'super_user'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "ur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "ur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."is_active" = true) AND ("p"."permission_key" = 'can_manage_global_settings'::"text"))))));



CREATE POLICY "Admin read all transactions" ON "public"."mcredit_transactions" FOR SELECT TO "authenticated" USING ("public"."is_admin_user"("auth"."uid"()));



CREATE POLICY "Admins can insert all receipts" ON "public"."mcredit_receipts" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "pur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "pur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true) AND ("p"."permission_key" = ANY (ARRAY['can_approve_topups'::"text", 'can_reject_topups'::"text", 'can_view_wallet_control'::"text"])))))));



CREATE POLICY "Admins can select all receipts" ON "public"."mcredit_receipts" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Admins can select all requests" ON "public"."mcredit_topup_requests" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Admins can update all receipts" ON "public"."mcredit_receipts" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Admins can update all requests" ON "public"."mcredit_topup_requests" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "ur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "ur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."is_active" = true) AND ("p"."permission_key" = ANY (ARRAY['can_approve_topups'::"text", 'can_reject_topups'::"text"])))))));



CREATE POLICY "Admins can update refund requests" ON "public"."mcredit_refund_requests" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "ur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "ur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."is_active" = true) AND ("p"."permission_key" = 'can_manage_refund_reviews'::"text")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "ur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "ur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."is_active" = true) AND ("p"."permission_key" = 'can_manage_refund_reviews'::"text"))))));



CREATE POLICY "Allow admins to manage content variables" ON "public"."cms_content_variables" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role", 'super_user'::"public"."platform_global_role"]))))) OR "public"."current_user_has_platform_admin_permission"('can_manage_content_pages'::"text")));



CREATE POLICY "Allow admins to manage faqs" ON "public"."cms_faqs" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role", 'super_user'::"public"."platform_global_role"]))))) OR "public"."current_user_has_platform_admin_permission"('can_manage_faqs'::"text")));



CREATE POLICY "Allow admins to manage pages" ON "public"."cms_pages" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role", 'super_user'::"public"."platform_global_role"]))))) OR "public"."current_user_has_platform_admin_permission"('can_manage_content_pages'::"text")));



CREATE POLICY "Allow admins to manage sections" ON "public"."cms_page_sections" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role", 'super_user'::"public"."platform_global_role"]))))) OR "public"."current_user_has_platform_admin_permission"('can_manage_content_pages'::"text")));



CREATE POLICY "Allow authenticated creator to create group threads" ON "public"."group_threads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow cross-user message notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow group owners to archive" ON "public"."groups" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Allow public read access to brand assets" ON "public"."global_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public select of active sections" ON "public"."cms_page_sections" FOR SELECT USING ((("is_active" = true) AND ("page_id" IN ( SELECT "cms_pages"."id"
   FROM "public"."cms_pages"
  WHERE ("cms_pages"."is_published" = true)))));



CREATE POLICY "Allow public select of content variables" ON "public"."cms_content_variables" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Allow public select of published faqs" ON "public"."cms_faqs" FOR SELECT USING ((("is_published" = true) AND (("page_id" IS NULL) OR ("page_id" IN ( SELECT "cms_pages"."id"
   FROM "public"."cms_pages"
  WHERE ("cms_pages"."is_published" = true))))));



CREATE POLICY "Allow public select of published pages" ON "public"."cms_pages" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Anyone can read group posts" ON "public"."logbook_posts" FOR SELECT USING ((("group_id" IS NOT NULL) AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Anyone can view experience." ON "public"."experience" FOR SELECT USING (true);



CREATE POLICY "Anyone can view mblog article comments" ON "public"."mblog_article_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view mblog article likes" ON "public"."mblog_article_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view posts." ON "public"."logbook_posts" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reputation" ON "public"."candidate_reputation_summary" FOR SELECT USING (true);



CREATE POLICY "Audit viewers can read audit logs" ON "public"."platform_admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."current_user_has_platform_admin_permission"('can_view_admin_audit_logs'::"text"));



CREATE POLICY "Authenticated users can create articles" ON "public"."mblog_articles" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Authenticated users can create companies" ON "public"."companies" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert review cases" ON "public"."refund_review_cases" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can manage their own comments" ON "public"."mblog_article_comments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can post jobs" ON "public"."jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "poster_id"));



CREATE POLICY "Authenticated users can toggle their own likes" ON "public"."mblog_article_likes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authors can delete their own articles" ON "public"."mblog_articles" FOR DELETE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Authors can update their own articles" ON "public"."mblog_articles" FOR UPDATE USING (("auth"."uid"() = "author_id"));



CREATE POLICY "Candidates can create cancellations" ON "public"."job_cancellations" FOR INSERT WITH CHECK (("auth"."uid"() = "cancelled_by"));



CREATE POLICY "Candidates can insert advance requests" ON "public"."job_advance_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "applicant_id") AND (EXISTS ( SELECT 1
   FROM ("public"."applications" "app"
     JOIN "public"."jobs" "j" ON (("j"."id" = "app"."job_id")))
  WHERE (("app"."id" = "job_advance_requests"."application_id") AND ("app"."applicant_id" = "auth"."uid"()) AND ("j"."advance_payment_enabled" = true))))));



CREATE POLICY "Candidates can view their refund review cases" ON "public"."refund_review_cases" FOR SELECT USING ((("auth"."uid"() = "candidate_id") OR ("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."poster_id" = "auth"."uid"())))));



CREATE POLICY "Comment owners and mods/admins can delete" ON "public"."group_comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."group_posts" "p"
  WHERE (("p"."id" = "group_comments"."post_id") AND ("public"."get_user_role"("p"."group_id") = ANY (ARRAY['moderator'::"text", 'admin'::"text"])))))));



CREATE POLICY "Comments are viewable by everyone" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Companies can view their review cases" ON "public"."refund_review_cases" FOR SELECT USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."poster_id" = "auth"."uid"()))));



CREATE POLICY "Company member read company transactions" ON "public"."mcredit_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mcredit_wallets"
  WHERE (("mcredit_wallets"."id" = "mcredit_transactions"."wallet_id") AND ("mcredit_wallets"."owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."company_members"
          WHERE (("company_members"."company_id" = "mcredit_wallets"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"()))))))));



CREATE POLICY "Company member read company wallet" ON "public"."mcredit_wallets" FOR SELECT TO "authenticated" USING ((("owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_wallets"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Company members are viewable by everyone" ON "public"."company_members" FOR SELECT USING (true);



CREATE POLICY "Employers can update applications for their jobs" ON "public"."applications" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "applications"."job_id") AND ("jobs"."poster_id" = "auth"."uid"())))));



CREATE POLICY "Enable insert access for notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."group_posts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."notification_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Everyone can read articles" ON "public"."mblog_articles" FOR SELECT USING (true);



CREATE POLICY "Group members delete policy" ON "public"."group_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("public"."get_user_role"("group_id") = ANY (ARRAY['admin'::"text", 'moderator'::"text"]))));



CREATE POLICY "Group members insert policy" ON "public"."group_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Group members select policy" ON "public"."group_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_member"("group_id")));



CREATE POLICY "Group members update policy" ON "public"."group_members" FOR UPDATE USING (("public"."get_user_role"("group_id") = ANY (ARRAY['admin'::"text", 'moderator'::"text"])));



CREATE POLICY "Groups insert policy" ON "public"."groups" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Groups select policy" ON "public"."groups" FOR SELECT USING (true);



CREATE POLICY "Groups update policy" ON "public"."groups" FOR UPDATE USING (("public"."get_user_role"("id") = 'admin'::"text"));



CREATE POLICY "Involved parties and admins can view audit logs" ON "public"."job_advance_audit_logs" FOR SELECT TO "authenticated" USING ((("actor_id" = "auth"."uid"()) OR ("job_id" IN ( SELECT "j"."id"
   FROM "public"."jobs" "j"
  WHERE (("j"."poster_id" = "auth"."uid"()) OR ("j"."company_id" IN ( SELECT "cm"."company_id"
           FROM "public"."company_members" "cm"
          WHERE ("cm"."profile_id" = "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."job_advance_requests" "r"
  WHERE (("r"."id" = "job_advance_audit_logs"."request_id") AND ("r"."applicant_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Involved parties can update advance requests" ON "public"."job_advance_requests" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "applicant_id") OR ("job_id" IN ( SELECT "j"."id"
   FROM "public"."jobs" "j"
  WHERE (("j"."poster_id" = "auth"."uid"()) OR ("j"."company_id" IN ( SELECT "cm"."company_id"
           FROM "public"."company_members" "cm"
          WHERE ("cm"."profile_id" = "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true)))))) WITH CHECK ((("auth"."uid"() = "applicant_id") OR ("job_id" IN ( SELECT "j"."id"
   FROM "public"."jobs" "j"
  WHERE (("j"."poster_id" = "auth"."uid"()) OR ("j"."company_id" IN ( SELECT "cm"."company_id"
           FROM "public"."company_members" "cm"
          WHERE ("cm"."profile_id" = "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Involved parties can update cancellations" ON "public"."job_cancellations" FOR UPDATE USING ((("auth"."uid"() = "cancelled_by") OR ("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."poster_id" = "auth"."uid"()))))) WITH CHECK ((("auth"."uid"() = "cancelled_by") OR ("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."poster_id" = "auth"."uid"())))));



CREATE POLICY "Likes are viewable by everyone" ON "public"."group_post_likes" FOR SELECT USING (true);



CREATE POLICY "Likes are viewable by everyone" ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Members can create thread messages" ON "public"."group_thread_messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."group_threads" "gt"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "gt"."group_id")))
  WHERE (("gt"."id" = "group_thread_messages"."thread_id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."status" = 'member'::"text") AND ("gt"."is_deleted" = false))))));



CREATE POLICY "Members can insert comments" ON "public"."group_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can insert posts" ON "public"."group_posts" FOR INSERT WITH CHECK ((("public"."get_user_role"("group_id") = ANY (ARRAY['member'::"text", 'moderator'::"text", 'admin'::"text"])) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Members can view comments" ON "public"."group_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_posts" "p"
  WHERE (("p"."id" = "group_comments"."post_id") AND ("public"."get_user_role"("p"."group_id") = ANY (ARRAY['member'::"text", 'moderator'::"text", 'admin'::"text"]))))));



CREATE POLICY "Members can view group threads" ON "public"."group_threads" FOR SELECT TO "authenticated" USING ((("is_deleted" = false) AND (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_threads"."group_id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."status" = 'member'::"text"))))));



CREATE POLICY "Members can view posts" ON "public"."group_posts" FOR SELECT USING (("public"."get_user_role"("group_id") = ANY (ARRAY['member'::"text", 'moderator'::"text", 'admin'::"text"])));



CREATE POLICY "Members can view thread messages" ON "public"."group_thread_messages" FOR SELECT TO "authenticated" USING ((("is_deleted" = false) AND (EXISTS ( SELECT 1
   FROM ("public"."group_threads" "gt"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "gt"."group_id")))
  WHERE (("gt"."id" = "group_thread_messages"."thread_id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."status" = 'member'::"text") AND ("gt"."is_deleted" = false))))));



CREATE POLICY "Only Super Users can write to global configuration" ON "public"."global_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = 'super_user'::"public"."platform_global_role")))));



CREATE POLICY "Owners and Admins can update company info" ON "public"."companies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "companies"."id") AND ("company_members"."profile_id" = "auth"."uid"()) AND ("company_members"."role" = ANY (ARRAY['Owner'::"text", 'Admin'::"text"]))))));



CREATE POLICY "Participants can delete application_messages" ON "public"."application_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."application_threads" "t"
  WHERE (("t"."id" = "application_messages"."thread_id") AND (("t"."applicant_id" = "auth"."uid"()) OR ("t"."poster_user_id" = "auth"."uid"()))))));



CREATE POLICY "Participants can delete conversations" ON "public"."conversations" FOR DELETE USING ((("auth"."uid"() = "participant_one") OR ("auth"."uid"() = "participant_two")));



CREATE POLICY "Participants can insert application_threads" ON "public"."application_threads" FOR INSERT WITH CHECK ((("auth"."uid"() = "applicant_id") OR ("auth"."uid"() = "poster_user_id")));



CREATE POLICY "Participants can read application_messages" ON "public"."application_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."application_threads" "t"
  WHERE (("t"."id" = "application_messages"."thread_id") AND (("t"."applicant_id" = "auth"."uid"()) OR ("t"."poster_user_id" = "auth"."uid"()))))));



CREATE POLICY "Participants can read application_threads" ON "public"."application_threads" FOR SELECT USING ((("auth"."uid"() = "applicant_id") OR ("auth"."uid"() = "poster_user_id")));



CREATE POLICY "Participants can view feedback" ON "public"."job_feedback" FOR SELECT USING ((("auth"."uid"() = "candidate_id") OR ("auth"."uid"() = "feedback_by")));



CREATE POLICY "Platform admins can read permissions" ON "public"."platform_admin_permissions" FOR SELECT TO "authenticated" USING ("public"."current_user_has_platform_admin_access"());



CREATE POLICY "Platform admins can read role permissions" ON "public"."platform_admin_role_permissions" FOR SELECT TO "authenticated" USING ("public"."current_user_has_platform_admin_access"());



CREATE POLICY "Platform admins can read roles" ON "public"."platform_admin_roles" FOR SELECT TO "authenticated" USING ("public"."current_user_has_platform_admin_access"());



CREATE POLICY "Platform admins can read user roles" ON "public"."platform_admin_user_roles" FOR SELECT TO "authenticated" USING ("public"."current_user_has_platform_admin_access"());



CREATE POLICY "Post owners and mods/admins can delete" ON "public"."group_posts" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("public"."get_user_role"("group_id") = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))));



CREATE POLICY "Posters and company members can delete jobs" ON "public"."jobs" FOR DELETE USING ((("auth"."uid"() = "poster_id") OR (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "jobs"."company_id") AND ("company_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Posters and company members can update jobs" ON "public"."jobs" FOR UPDATE USING ((("auth"."uid"() = "poster_id") OR (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "jobs"."company_id") AND ("company_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Posters and company members can view job orders" ON "public"."job_orders" FOR SELECT USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE (("jobs"."poster_id" = "auth"."uid"()) OR ("jobs"."company_id" IN ( SELECT "company_members"."company_id"
           FROM "public"."company_members"
          WHERE ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Posters can insert feedback" ON "public"."job_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "feedback_by"));



CREATE POLICY "Posters can view applications for their jobs" ON "public"."applications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "applications"."job_id") AND ("jobs"."poster_id" = "auth"."uid"())))));



CREATE POLICY "Profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public Read platform_settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Public companies are viewable by everyone" ON "public"."companies" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Role managers can manage permissions" ON "public"."platform_admin_permissions" TO "authenticated" USING ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text")) WITH CHECK ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text"));



CREATE POLICY "Role managers can manage role permissions" ON "public"."platform_admin_role_permissions" TO "authenticated" USING ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text")) WITH CHECK ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text"));



CREATE POLICY "Role managers can manage roles" ON "public"."platform_admin_roles" TO "authenticated" USING ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text")) WITH CHECK ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text"));



CREATE POLICY "Role managers can manage user roles" ON "public"."platform_admin_user_roles" TO "authenticated" USING ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text")) WITH CHECK ("public"."current_user_has_platform_admin_permission"('can_manage_admin_roles'::"text"));



CREATE POLICY "Sender can insert application_messages" ON "public"."application_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."application_threads" "t"
  WHERE (("t"."id" = "application_messages"."thread_id") AND (("t"."applicant_id" = "auth"."uid"()) OR ("t"."poster_user_id" = "auth"."uid"())))))));



CREATE POLICY "Service role can manage review cases" ON "public"."refund_review_cases" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Support read all transactions" ON "public"."mcredit_transactions" FOR SELECT TO "authenticated" USING ("public"."has_admin_permission"("auth"."uid"(), 'can_view_wallet_summary'::"text"));



CREATE POLICY "Support select all wallets" ON "public"."mcredit_wallets" FOR SELECT TO "authenticated" USING ("public"."has_admin_permission"("auth"."uid"(), 'can_view_wallet_summary'::"text"));



CREATE POLICY "System and actors can insert audit logs" ON "public"."job_advance_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (("actor_id" = "auth"."uid"()));



CREATE POLICY "System can manage reputation" ON "public"."candidate_reputation_summary" USING (true);



CREATE POLICY "User read own transactions" ON "public"."mcredit_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mcredit_wallets"
  WHERE (("mcredit_wallets"."id" = "mcredit_transactions"."wallet_id") AND ("mcredit_wallets"."owner_type" = 'user'::"text") AND ("mcredit_wallets"."owner_id" = "auth"."uid"())))));



CREATE POLICY "User read own wallet" ON "public"."mcredit_wallets" FOR SELECT TO "authenticated" USING ((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can apply to jobs" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "applicant_id"));



CREATE POLICY "Users can cancel own pending requests" ON "public"."mcredit_topup_requests" FOR UPDATE USING ((("status" = 'Pending'::"text") AND ((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_topup_requests"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"())))))))) WITH CHECK (("status" = 'Cancelled'::"text"));



CREATE POLICY "Users can create friend requests" ON "public"."friendships" FOR INSERT WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can create job order if they own the application" ON "public"."job_orders" FOR INSERT WITH CHECK (("auth"."uid"() = "candidate_id"));



CREATE POLICY "Users can create their own membership on creation" ON "public"."company_members" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own likes" ON "public"."group_post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own likes" ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own posts." ON "public"."logbook_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can insert conversations they participate in" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "participant_one") OR ("auth"."uid"() = "participant_two")));



CREATE POLICY "Users can insert messages in their conversations as sender" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_one" = "auth"."uid"()) OR ("c"."participant_two" = "auth"."uid"())))))));



CREATE POLICY "Users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can insert own group posts" ON "public"."logbook_posts" FOR INSERT WITH CHECK ((("group_id" IS NOT NULL) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own receipts" ON "public"."mcredit_receipts" FOR INSERT TO "authenticated" WITH CHECK (((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_receipts"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert own refund requests" ON "public"."mcredit_refund_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("status" = 'pending_review'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."mcredit_wallets" "w"
  WHERE (("w"."id" = "mcredit_refund_requests"."wallet_id") AND ((("w"."owner_type" = 'user'::"text") AND ("w"."owner_id" = "auth"."uid"())) OR (("w"."owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."company_members" "cm"
          WHERE (("cm"."company_id" = "w"."owner_id") AND ("cm"."profile_id" = "auth"."uid"())))))))))));



CREATE POLICY "Users can insert own requests" ON "public"."mcredit_topup_requests" FOR INSERT WITH CHECK (((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"()) AND ("requester_id" = "auth"."uid"())) OR (("owner_type" = 'company'::"text") AND ("requester_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_topup_requests"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert posts for themselves or their companies." ON "public"."logbook_posts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("posted_as_company_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "logbook_posts"."posted_as_company_id") AND ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert their own likes" ON "public"."group_post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own likes" ON "public"."likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own experience." ON "public"."experience" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own notification settings" ON "public"."notification_settings" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can post comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can see all follows" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Users can select own receipts" ON "public"."mcredit_receipts" FOR SELECT TO "authenticated" USING (((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_receipts"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can select own refund requests" ON "public"."mcredit_refund_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM ((("public"."platform_admin_user_roles" "ur"
     JOIN "public"."platform_admin_roles" "r" ON (("r"."id" = "ur"."role_id")))
     JOIN "public"."platform_admin_role_permissions" "rp" ON (("rp"."role_id" = "r"."id")))
     JOIN "public"."platform_admin_permissions" "p" ON (("p"."id" = "rp"."permission_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."is_active" = true) AND ("p"."permission_key" = ANY (ARRAY['can_manage_refund_reviews'::"text", 'can_view_wallet_summary'::"text"])))))));



CREATE POLICY "Users can select own requests" ON "public"."mcredit_topup_requests" FOR SELECT USING (((("owner_type" = 'user'::"text") AND ("owner_id" = "auth"."uid"())) OR (("owner_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "mcredit_topup_requests"."owner_id") AND ("company_members"."profile_id" = "auth"."uid"())))))));



CREATE POLICY "Users can unfollow others" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can update job orders if involved" ON "public"."job_orders" FOR UPDATE USING ((("auth"."uid"() = "candidate_id") OR ("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE (("jobs"."poster_id" = "auth"."uid"()) OR ("jobs"."company_id" IN ( SELECT "company_members"."company_id"
           FROM "public"."company_members"
          WHERE ("company_members"."profile_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update read states on their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Users can update their own applications" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "applicant_id"));



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own friendships" ON "public"."friendships" FOR UPDATE USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Users can update their own posts." ON "public"."logbook_posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profiles." ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view and update their own settings" ON "public"."user_notification_settings_archive" TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view involved advance requests" ON "public"."job_advance_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "applicant_id") OR ("job_id" IN ( SELECT "j"."id"
   FROM "public"."jobs" "j"
  WHERE (("j"."poster_id" = "auth"."uid"()) OR ("j"."company_id" IN ( SELECT "cm"."company_id"
           FROM "public"."company_members" "cm"
          WHERE ("cm"."profile_id" = "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."global_role" = ANY (ARRAY['super_admin'::"public"."platform_global_role", 'admin'::"public"."platform_global_role", 'brand_manager'::"public"."platform_global_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."platform_admin_user_roles" "pur"
  WHERE (("pur"."user_id" = "auth"."uid"()) AND ("pur"."is_active" = true))))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."participant_one" = "auth"."uid"()) OR ("c"."participant_two" = "auth"."uid"()))))));



CREATE POLICY "Users can view open or their own jobs" ON "public"."jobs" FOR SELECT USING ((("status" = 'Published'::"text") OR ("status" = 'Closed'::"text") OR ("auth"."uid"() = "poster_id") OR (EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "jobs"."company_id") AND ("company_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their cancellations" ON "public"."job_cancellations" FOR SELECT USING ((("auth"."uid"() = "cancelled_by") OR ("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."poster_id" = "auth"."uid"()))) OR ("application_id" IN ( SELECT "applications"."id"
   FROM "public"."applications"
  WHERE ("applications"."applicant_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their job orders" ON "public"."job_orders" FOR SELECT USING (("auth"."uid"() = "candidate_id"));



CREATE POLICY "Users can view their own applications" ON "public"."applications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "applicant_id"));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "participant_one") OR ("auth"."uid"() = "participant_two")));



CREATE POLICY "Users can view their own friendships" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "recipient_id")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "recipient_id"));



ALTER TABLE "public"."application_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_reputation_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_content_variables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_faqs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_page_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_attachment_cleanup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_legacy_mirror_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_message_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_message_attachments_read" ON "public"."group_message_attachments" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND "group_attachments_private"."is_accepted_member"(( SELECT "auth"."uid"() AS "uid"), "group_id") AND (EXISTS ( SELECT 1
   FROM "public"."group_threads" "t"
  WHERE (("t"."id" = "group_message_attachments"."thread_id") AND ("t"."group_id" = "t"."group_id") AND (NOT "t"."is_deleted") AND (NOT "t"."is_archived")))) AND (EXISTS ( SELECT 1
   FROM "public"."group_thread_messages" "m"
  WHERE (("m"."id" = "group_message_attachments"."message_id") AND ("m"."thread_id" = "m"."thread_id") AND ("m"."delivery_status" = 'published'::"text") AND (NOT "m"."is_deleted"))))));



ALTER TABLE "public"."group_message_reservation_cleanup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_thread_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_thread_messages_active_member_guard" ON "public"."group_thread_messages" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((("delivery_status" = 'published'::"text") AND (NOT "is_deleted") AND (EXISTS ( SELECT 1
   FROM "public"."group_threads" "t"
  WHERE (("t"."id" = "group_thread_messages"."thread_id") AND (NOT "t"."is_deleted") AND (NOT "t"."is_archived") AND "group_attachments_private"."is_accepted_member"(( SELECT "auth"."uid"() AS "uid"), "t"."group_id"))))));



CREATE POLICY "group_thread_messages_anonymous_deny" ON "public"."group_thread_messages" AS RESTRICTIVE FOR SELECT TO "anon" USING (false);



CREATE POLICY "group_thread_messages_legacy_insert_guard" ON "public"."group_thread_messages" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("delivery_status" = 'published'::"text") AND ("reservation_request" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."group_threads" "t"
  WHERE (("t"."id" = "group_thread_messages"."thread_id") AND (NOT "t"."is_deleted") AND (NOT "t"."is_archived") AND "group_attachments_private"."is_accepted_member"(( SELECT "auth"."uid"() AS "uid"), "t"."group_id"))))));



ALTER TABLE "public"."group_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_advance_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_advance_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_cancellations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logbook_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mblog_article_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mblog_article_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mblog_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcredit_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcredit_refund_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcredit_topup_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcredit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcredit_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admin_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admin_role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admin_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admin_user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_review_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_settings_archive" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."application_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."application_threads";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."group_thread_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."logbook_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "group_attachments_private" TO "authenticated";
GRANT USAGE ON SCHEMA "group_attachments_private" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "group_attachments_private"."can_moderate"("p_user_id" "uuid", "p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "group_attachments_private"."can_moderate"("p_user_id" "uuid", "p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "group_attachments_private"."can_moderate"("p_user_id" "uuid", "p_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "group_attachments_private"."can_remove"("p_user_id" "uuid", "p_attachment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "group_attachments_private"."can_remove"("p_user_id" "uuid", "p_attachment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "group_attachments_private"."can_remove"("p_user_id" "uuid", "p_attachment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "group_attachments_private"."guard_message_publication_cleanup"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "group_attachments_private"."is_accepted_member"("p_user_id" "uuid", "p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "group_attachments_private"."is_accepted_member"("p_user_id" "uuid", "p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "group_attachments_private"."is_accepted_member"("p_user_id" "uuid", "p_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "group_attachments_private"."object_authorized"("p_user_id" "uuid", "p_object_name" "text", "p_write" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "group_attachments_private"."object_authorized"("p_user_id" "uuid", "p_object_name" "text", "p_write" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "group_attachments_private"."object_authorized"("p_user_id" "uuid", "p_object_name" "text", "p_write" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_job_offer"("app_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_job_offer"("app_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_job_offer"("app_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_job_offer"("app_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."adjust_wallet_balance"("p_wallet_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_transaction_type" "text", "p_justification_note" "text", "p_created_by" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_override_insufficient" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_wallet_balance"("p_wallet_id" "uuid", "p_amount" numeric, "p_direction" "text", "p_transaction_type" "text", "p_justification_note" "text", "p_created_by" "uuid", "p_reference_type" "text", "p_reference_id" "uuid", "p_override_insufficient" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_group_message_reservation"("p_message_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_group_message_reservation"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_group_message_reservation"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_application_messaging_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_application_messaging_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_application_messaging_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_conversation_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_conversation_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_conversation_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_job_compensation_immutable"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_job_compensation_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_job_compensation_immutable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_job_order_existence_v1"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_job_order_existence_v1"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_job_order_existence_v1"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_message_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_message_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_message_permissions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_group_attachment_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_group_attachment_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_group_message_reservation_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_group_message_reservation_cleanup"("p_job_id" "uuid", "p_worker" "text", "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."close_completed_engagement_by_company"("p_job_order_id" "uuid", "p_sentiment" "text", "p_tags" "text"[], "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."close_completed_engagement_by_company"("p_job_order_id" "uuid", "p_sentiment" "text", "p_tags" "text"[], "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_completed_engagement_by_company"("p_job_order_id" "uuid", "p_sentiment" "text", "p_tags" "text"[], "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_work_completed_by_company"("p_job_order_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_work_completed_by_company"("p_job_order_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_work_completed_by_company"("p_job_order_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_permission"("required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_permission"("required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_platform_admin_permission"("required_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_group_message_attachment_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_group_message_attachment_relationship"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_relationship"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_relationship"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_group_message_attachment_relationship"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_group_thread_message_delivery_transition"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_group_thread_message_delivery_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_group_thread_message_delivery_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_group_thread_message_delivery_transition"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_due_group_attachment_cleanup"("p_now" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_due_group_attachment_cleanup"("p_now" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_group_attachment_validation_candidate"("p_attachment_id" "uuid", "p_requesting_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_group_attachment_validation_candidate"("p_attachment_id" "uuid", "p_requesting_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_job_filled_positions"("job_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_job_filled_positions"("job_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_job_filled_positions"("job_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_owner_type" "text", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_owner_type" "text", "p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_wallet"("p_owner_type" "text", "p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_topup_requests_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_topup_requests_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_topup_requests_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_email"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("target_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("target_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("target_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_company_wallet"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_company_wallet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_company_wallet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_group_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_group_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_group_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_profile_wallet"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_profile_wallet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_profile_wallet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_admin_permission"("p_user_id" "uuid", "p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_admin_permission"("p_user_id" "uuid", "p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_admin_permission"("p_user_id" "uuid", "p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("target_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("target_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("target_group_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_group_message_attachment_ready"("p_attachment_id" "uuid", "p_actual_mime_type" "text", "p_actual_byte_size" bigint, "p_content_sha256" "text", "p_inspection_metadata" "jsonb", "p_inspector" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_group_message_attachment_ready"("p_attachment_id" "uuid", "p_actual_mime_type" "text", "p_actual_byte_size" bigint, "p_content_sha256" "text", "p_inspection_metadata" "jsonb", "p_inspector" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_group_thread_message"("p_message_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_group_thread_message"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_group_thread_message"("p_message_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_group_thread_message"("p_message_id" "uuid", "p_thread_id" "uuid", "p_content" "text", "p_attachments" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_group_thread_message"("p_message_id" "uuid", "p_thread_id" "uuid", "p_content" "text", "p_attachments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_group_thread_message"("p_message_id" "uuid", "p_thread_id" "uuid", "p_content" "text", "p_attachments" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_platform_admin_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_platform_admin_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_platform_admin_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_group_message"("p_message_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_group_message"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_group_message"("p_message_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_group_message_attachment"("p_attachment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_group_message_attachment"("p_attachment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_group_message_attachment"("p_attachment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_role_permissions"("p_role_id" "uuid", "p_permission_keys" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_role_permissions"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_app_thread_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_app_thread_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_app_thread_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_friendships_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_friendships_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_friendships_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."application_messages" TO "anon";
GRANT ALL ON TABLE "public"."application_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."application_messages" TO "service_role";



GRANT ALL ON TABLE "public"."application_threads" TO "anon";
GRANT ALL ON TABLE "public"."application_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."application_threads" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_reputation_summary" TO "anon";
GRANT ALL ON TABLE "public"."candidate_reputation_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_reputation_summary" TO "service_role";



GRANT ALL ON TABLE "public"."cms_content_variables" TO "anon";
GRANT ALL ON TABLE "public"."cms_content_variables" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_content_variables" TO "service_role";



GRANT ALL ON TABLE "public"."cms_faqs" TO "anon";
GRANT ALL ON TABLE "public"."cms_faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_faqs" TO "service_role";



GRANT ALL ON TABLE "public"."cms_page_sections" TO "anon";
GRANT ALL ON TABLE "public"."cms_page_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_page_sections" TO "service_role";



GRANT ALL ON TABLE "public"."cms_pages" TO "anon";
GRANT ALL ON TABLE "public"."cms_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_pages" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_members" TO "anon";
GRANT ALL ON TABLE "public"."company_members" TO "authenticated";
GRANT ALL ON TABLE "public"."company_members" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."experience" TO "anon";
GRANT ALL ON TABLE "public"."experience" TO "authenticated";
GRANT ALL ON TABLE "public"."experience" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";



GRANT ALL ON TABLE "public"."group_attachment_cleanup_queue" TO "service_role";



GRANT ALL ON TABLE "public"."group_comments" TO "anon";
GRANT ALL ON TABLE "public"."group_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."group_comments" TO "service_role";



GRANT ALL ON TABLE "public"."group_legacy_mirror_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_message_attachments" TO "service_role";
GRANT SELECT ON TABLE "public"."group_message_attachments" TO "authenticated";



GRANT ALL ON TABLE "public"."group_message_reservation_cleanup_queue" TO "service_role";



GRANT ALL ON TABLE "public"."group_post_likes" TO "anon";
GRANT ALL ON TABLE "public"."group_post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."group_post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."group_posts" TO "anon";
GRANT ALL ON TABLE "public"."group_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."group_posts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_thread_messages" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_thread_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."group_thread_messages" TO "service_role";



GRANT INSERT("id") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("thread_id") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("content") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("reply_to_message_id") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("reply_author_name") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT INSERT("reply_preview") ON TABLE "public"."group_thread_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."group_threads" TO "anon";
GRANT ALL ON TABLE "public"."group_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."group_threads" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."job_advance_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."job_advance_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_advance_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."job_advance_requests" TO "anon";
GRANT ALL ON TABLE "public"."job_advance_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."job_advance_requests" TO "service_role";



GRANT ALL ON TABLE "public"."job_cancellations" TO "anon";
GRANT ALL ON TABLE "public"."job_cancellations" TO "authenticated";
GRANT ALL ON TABLE "public"."job_cancellations" TO "service_role";



GRANT ALL ON TABLE "public"."job_feedback" TO "anon";
GRANT ALL ON TABLE "public"."job_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."job_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."job_orders" TO "anon";
GRANT ALL ON TABLE "public"."job_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."job_orders" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."jobs_search_view" TO "anon";
GRANT ALL ON TABLE "public"."jobs_search_view" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs_search_view" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."logbook_posts" TO "anon";
GRANT ALL ON TABLE "public"."logbook_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."logbook_posts" TO "service_role";



GRANT ALL ON TABLE "public"."mblog_article_comments" TO "anon";
GRANT ALL ON TABLE "public"."mblog_article_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."mblog_article_comments" TO "service_role";



GRANT ALL ON TABLE "public"."mblog_article_likes" TO "anon";
GRANT ALL ON TABLE "public"."mblog_article_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."mblog_article_likes" TO "service_role";



GRANT ALL ON TABLE "public"."mblog_articles" TO "anon";
GRANT ALL ON TABLE "public"."mblog_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."mblog_articles" TO "service_role";



GRANT ALL ON TABLE "public"."mcredit_receipts" TO "anon";
GRANT ALL ON TABLE "public"."mcredit_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."mcredit_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."mcredit_refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."mcredit_refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."mcredit_refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."mcredit_topup_requests" TO "anon";
GRANT ALL ON TABLE "public"."mcredit_topup_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."mcredit_topup_requests" TO "service_role";



GRANT ALL ON TABLE "public"."mcredit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."mcredit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."mcredit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."mcredit_wallets" TO "anon";
GRANT ALL ON TABLE "public"."mcredit_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."mcredit_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."platform_admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admin_permissions" TO "anon";
GRANT ALL ON TABLE "public"."platform_admin_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admin_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admin_role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."platform_admin_role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admin_role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."platform_admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admin_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."platform_admin_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admin_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."refund_review_cases" TO "anon";
GRANT ALL ON TABLE "public"."refund_review_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_review_cases" TO "service_role";



GRANT ALL ON TABLE "public"."thread_participants" TO "anon";
GRANT ALL ON TABLE "public"."thread_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_participants" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_settings_archive" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_settings_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_settings_archive" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































