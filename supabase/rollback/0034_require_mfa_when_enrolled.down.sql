-- Undoes 0034_require_mfa_when_enrolled.sql. Not a migration: run it by hand only if 0034 has to be reverted.
begin;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop policy if exists "require 2fa when enrolled" on public.%I', t.relname);
  end loop;
end
$$;
drop function if exists public.mfa_requirement_met();

commit;
