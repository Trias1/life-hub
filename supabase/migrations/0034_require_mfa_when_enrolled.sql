-- Accounts that turned on two-factor authentication must finish the code step (aal2) before they can
-- read or change any data. Without this, someone with the password could sign in (aal1) and call
-- PostgREST directly with the public key, skipping the app's 6-digit code page entirely.
-- The factor list is read from auth.mfa_factors and the level from the signed JWT, neither of which
-- the client can edit. Accounts without a verified authenticator are unaffected.
-- Apply after 0033.
begin;

create or replace function public.mfa_requirement_met()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke all on function public.mfa_requirement_met() from public;
grant execute on function public.mfa_requirement_met() to anon, authenticated;

-- RESTRICTIVE policies are ANDed with the existing ones, so no permissive policy can bypass this.
-- "(select ...)" lets Postgres evaluate it once per statement instead of once per row.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "require 2fa when enrolled" on public.%I', t.relname);
    execute format('create policy "require 2fa when enrolled" on public.%I as restrictive for all to authenticated using ((select public.mfa_requirement_met())) with check ((select public.mfa_requirement_met()))', t.relname);
  end loop;
end
$$;

commit;
