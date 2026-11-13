-- Undoes 0039_public_share_rate_limit.sql. Not a migration: run it by hand only if 0039 has to be reverted.
-- Public share links stop being limited per client (the app then fails closed with 503, so revert the
-- app change first).
begin;

drop function if exists public.consume_public_rate_limit(text, text);
drop table if exists public.public_request_limits;

commit;
