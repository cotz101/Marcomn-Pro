-- B-CRIT: close critical email, platform-role, and company-membership escalation paths.

create or replace function public.get_user_email(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  v_email text;
begin
  if v_jwt_role <> 'service_role' and (v_actor_id is null or v_actor_id <> p_user_id) then
    raise exception 'Not authorized to access this email'
      using errcode = '42501';
  end if;

  select users.email
    into v_email
    from auth.users
   where users.id = p_user_id;

  return v_email;
end;
$$;

revoke all on function public.get_user_email(uuid) from public;
revoke all on function public.get_user_email(uuid) from anon;
grant execute on function public.get_user_email(uuid) to authenticated;
grant execute on function public.get_user_email(uuid) to service_role;

-- RLS limits which profile row may be updated; column privileges protect the
-- immutable identity key and legacy platform authorization field on that row.
revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;
grant update (
  id,
  username,
  name,
  avatar_url,
  website,
  headline,
  location,
  about,
  cover_photo_url,
  current_company,
  bio,
  onboarding_completed,
  "previousRole",
  skills,
  "isSailing",
  "vesselName",
  "openToWork",
  "currentRole",
  "yearsExperience",
  message_privacy,
  inbox_privacy
) on table public.profiles to authenticated;

alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can update their own profiles." on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Company creation and initial Owner assignment must be one authenticated,
-- atomic database operation. Generic browser inserts are no longer trusted.
create or replace function public.create_company_with_owner(
  p_name text,
  p_industry text default null,
  p_website text default null,
  p_location text default null,
  p_bio text default null
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_company public.companies;
begin
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Company name is required'
      using errcode = '22023';
  end if;

  insert into public.companies (name, industry, website, location, bio)
  values (
    btrim(p_name),
    nullif(btrim(p_industry), ''),
    nullif(btrim(p_website), ''),
    nullif(btrim(p_location), ''),
    nullif(btrim(p_bio), '')
  )
  returning * into v_company;

  insert into public.company_members (company_id, profile_id, role)
  values (v_company.id, v_actor_id, 'Owner');

  return v_company;
end;
$$;

revoke all on function public.create_company_with_owner(text, text, text, text, text) from public;
revoke all on function public.create_company_with_owner(text, text, text, text, text) from anon;
grant execute on function public.create_company_with_owner(text, text, text, text, text) to authenticated;
grant execute on function public.create_company_with_owner(text, text, text, text, text) to service_role;

drop policy if exists "Users can create their own membership on creation"
  on public.company_members;

revoke insert on table public.companies from anon;
revoke insert on table public.companies from authenticated;
revoke insert, update on table public.company_members from anon;
revoke insert, update on table public.company_members from authenticated;
