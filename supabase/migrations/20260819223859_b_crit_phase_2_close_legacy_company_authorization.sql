-- B-CRIT Phase 2: close legacy Company authorization paths.
--
-- Apply only after the application using create_company_with_owner has been
-- deployed and its RPC-based Company creation path has been verified.

drop policy if exists "Users can create their own membership on creation"
  on public.company_members;

revoke insert on table public.companies from anon;
revoke insert on table public.companies from authenticated;
revoke insert, update on table public.company_members from anon;
revoke insert, update on table public.company_members from authenticated;
