-- Undoes 0038_mfa_for_rpc_functions.sql. Not a migration: run it by hand only if 0038 has to be reverted.
-- Puts the original functions back under their names, with the grants they had before.
begin;

drop function if exists public.create_workspace(text, text);
drop function if exists public.accept_workspace_invitation(text);
drop function if exists public.list_my_invitations();
drop function if exists public.respond_to_my_invitation(uuid, boolean);

alter function public.create_workspace_unchecked(text, text) rename to create_workspace;
alter function public.accept_workspace_invitation_unchecked(text) rename to accept_workspace_invitation;
alter function public.list_my_invitations_unchecked() rename to list_my_invitations;
alter function public.respond_to_my_invitation_unchecked(uuid, boolean) rename to respond_to_my_invitation;

grant execute on function public.create_workspace(text, text) to anon, authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.list_my_invitations() to anon, authenticated;
grant execute on function public.respond_to_my_invitation(uuid, boolean) to anon, authenticated;
grant execute on function public.ensure_workspace_membership() to public, anon, authenticated;

drop function if exists public.require_mfa_step();

commit;
