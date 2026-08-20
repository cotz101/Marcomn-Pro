-- A1: publish a canonical Draft and charge its canonical MCredit wallet in one transaction.
-- A2 currency-normalized pricing is intentionally deferred; salary_numeric retains its
-- existing raw percentage semantics.

-- Persist the immutable publication result on the job itself. A zero-fee
-- publication intentionally has no ledger row (ledger amounts must be positive),
-- so current fee configuration can never be used to infer its historical result.
alter table public.jobs
  add column if not exists mcredit_publication_fee numeric(12,2),
  add column if not exists mcredit_publication_transaction_id uuid references public.mcredit_transactions(id) on delete restrict,
  add column if not exists mcredit_published_at timestamptz;

create or replace function public.enforce_atomic_job_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('Published', 'Open')
     and (tg_op = 'INSERT' or old.status not in ('Published', 'Open'))
     and coalesce(pg_catalog.current_setting('app.atomic_job_publish_id', true), '') <> new.id::text then
    raise exception 'Jobs must be published through publish_job_with_mcredit.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_atomic_job_publication
before insert or update of status on public.jobs
for each row execute function public.enforce_atomic_job_publication();

create or replace function public.publish_job_with_mcredit(
  p_job_id uuid,
  p_expected_fee numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_fee_percent numeric;
  v_fee numeric(12,2);
  v_owner_type text;
  v_owner_id uuid;
  v_wallet public.mcredit_wallets%rowtype;
  v_transaction public.mcredit_transactions%rowtype;
  v_transaction_id uuid;
  v_new_balance numeric(12,2);
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'unauthenticated');
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'job_not_found');
  end if;

  if v_job.company_id is null then
    if v_job.poster_id <> v_actor then
      return jsonb_build_object('success', false, 'code', 'unauthorized');
    end if;
    v_owner_type := 'user';
    v_owner_id := v_actor;
  else
    if not exists (
      select 1
      from public.company_members cm
      where cm.company_id = v_job.company_id
        and cm.profile_id = v_actor
        and cm.role in ('Owner', 'Admin', 'Member')
    ) then
      return jsonb_build_object('success', false, 'code', 'unauthorized');
    end if;
    v_owner_type := 'company';
    v_owner_id := v_job.company_id;
  end if;

  select t.id into v_transaction_id
  from public.mcredit_transactions t
  where t.reference_type = 'job_posting'
    and t.reference_id = v_job.id
    and t.transaction_type = 'spend'
    and t.direction = 'debit';

  if v_job.status in ('Published', 'Open') then
    if v_job.mcredit_publication_fee is null then
      return jsonb_build_object('success', false, 'code', 'published_without_a1_evidence');
    end if;

    if v_job.mcredit_publication_fee = 0 then
      if v_job.mcredit_publication_transaction_id is not null then
        return jsonb_build_object('success', false, 'code', 'invalid_zero_fee_publication_evidence');
      end if;
      return jsonb_build_object(
        'success', true,
        'code', 'already_published',
        'job_id', v_job.id,
        'transaction_id', null,
        'fee', 0,
        'status', v_job.status
      );
    end if;

    if v_job.mcredit_publication_transaction_id is null then
      return jsonb_build_object('success', false, 'code', 'published_without_posting_debit');
    end if;

    select * into v_transaction
    from public.mcredit_transactions
    where id = v_job.mcredit_publication_transaction_id;

    if not found
       or v_transaction.reference_type <> 'job_posting'
       or v_transaction.reference_id <> v_job.id
       or v_transaction.transaction_type <> 'spend'
       or v_transaction.direction <> 'debit'
       or v_transaction.amount <> v_job.mcredit_publication_fee
       or not exists (
         select 1
         from public.mcredit_wallets w
         where w.id = v_transaction.wallet_id
           and w.owner_type = v_owner_type
           and w.owner_id = v_owner_id
       ) then
      return jsonb_build_object('success', false, 'code', 'invalid_posting_debit_evidence');
    end if;

    return jsonb_build_object(
      'success', true,
      'code', 'already_published',
      'job_id', v_job.id,
      'transaction_id', v_transaction_id,
      'fee', v_job.mcredit_publication_fee,
      'status', v_job.status
    );
  end if;

  if v_job.status <> 'Draft' then
    return jsonb_build_object('success', false, 'code', 'invalid_job_status', 'status', v_job.status);
  end if;

  if v_transaction_id is not null then
    -- A legitimate debit must never be stranded behind a Draft state.
    perform pg_catalog.set_config('app.atomic_job_publish_id', v_job.id::text, true);
    update public.jobs
    set status = 'Published',
        mcredit_publication_fee = (select amount from public.mcredit_transactions where id = v_transaction_id),
        mcredit_publication_transaction_id = v_transaction_id,
        mcredit_published_at = pg_catalog.now()
    where id = v_job.id;
    perform pg_catalog.set_config('app.atomic_job_publish_id', '', true);
    return jsonb_build_object(
      'success', true,
      'code', 'repaired_published_state',
      'job_id', v_job.id,
      'transaction_id', v_transaction_id,
      'fee', (select amount from public.mcredit_transactions where id = v_transaction_id),
      'status', 'Published'
    );
  end if;

  select coalesce(nullif(trim(ps.value), '')::numeric, 1)
  into v_fee_percent
  from public.platform_settings ps
  where ps.key = 'company_job_posting_fee_percent';
  v_fee_percent := coalesce(v_fee_percent, 1);
  v_fee := round(coalesce(v_job.salary_numeric, 0) * v_fee_percent / 100, 2);

  if p_expected_fee is null or round(p_expected_fee, 2) <> v_fee then
    return jsonb_build_object(
      'success', false,
      'code', 'fee_changed',
      'expected_fee', p_expected_fee,
      'authoritative_fee', v_fee,
      'fee_percent', v_fee_percent
    );
  end if;

  if v_fee > 0 then
    -- Serialize wallet creation and charging across different jobs for the same owner.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_type || ':' || v_owner_id::text, 0));

    select * into v_wallet
    from public.mcredit_wallets
    where owner_type = v_owner_type and owner_id = v_owner_id
    for update;

    if not found then
      insert into public.mcredit_wallets (owner_type, owner_id, balance, status)
      values (v_owner_type, v_owner_id, 0, 'active')
      returning * into v_wallet;
    end if;

    if v_wallet.status <> 'active' then
      return jsonb_build_object('success', false, 'code', 'wallet_inactive', 'wallet_status', v_wallet.status);
    end if;

    if v_wallet.balance < v_fee then
      return jsonb_build_object(
        'success', false,
        'code', 'insufficient_balance',
        'required', v_fee,
        'available', v_wallet.balance
      );
    end if;

    v_new_balance := v_wallet.balance - v_fee;
    update public.mcredit_wallets
    set balance = v_new_balance, updated_at = pg_catalog.now()
    where id = v_wallet.id;

    insert into public.mcredit_transactions (
      wallet_id, transaction_type, direction, amount, balance_before, balance_after,
      reference_type, reference_id, description, justification_note, created_by
    ) values (
      v_wallet.id, 'spend', 'debit', v_fee, v_wallet.balance, v_new_balance,
      'job_posting', v_job.id,
      'Job posting fee',
      pg_catalog.format('Job posting fee (%s%% of %s) for job %s', v_fee_percent, v_job.salary_numeric, v_job.id),
      v_actor
    ) returning id into v_transaction_id;
  end if;

  perform pg_catalog.set_config('app.atomic_job_publish_id', v_job.id::text, true);
  update public.jobs
  set status = 'Published',
      mcredit_publication_fee = v_fee,
      mcredit_publication_transaction_id = v_transaction_id,
      mcredit_published_at = pg_catalog.now()
  where id = v_job.id;
  perform pg_catalog.set_config('app.atomic_job_publish_id', '', true);

  return jsonb_build_object(
    'success', true,
    'code', 'published',
    'job_id', v_job.id,
    'transaction_id', v_transaction_id,
    'fee', v_fee,
    'new_balance', v_new_balance,
    'wallet_owner_type', v_owner_type,
    'wallet_owner_id', v_owner_id,
    'status', 'Published'
  );
end;
$$;

revoke execute on function public.publish_job_with_mcredit(uuid, numeric) from public, anon;
grant execute on function public.publish_job_with_mcredit(uuid, numeric) to authenticated;
grant execute on function public.publish_job_with_mcredit(uuid, numeric) to service_role;

revoke execute on function public.enforce_atomic_job_publication() from public, anon, authenticated;
