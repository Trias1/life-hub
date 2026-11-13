-- Undoes 0037_mfa_recovery_codes.sql. Not a migration: run it by hand only if 0037 has to be reverted.
-- Existing recovery codes stop working; authenticators are not touched.
begin;

drop table if exists public.mfa_recovery_codes;

commit;
