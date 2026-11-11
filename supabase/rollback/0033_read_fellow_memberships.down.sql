-- Undoes 0033_read_fellow_memberships.sql (members see only their own membership row again).
-- Not a migration: run it by hand only if 0033 has to be reverted.
begin;

drop policy if exists "members can read fellow memberships" on public.workspace_members;
drop function if exists public.is_workspace_member(uuid);

commit;
