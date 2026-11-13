-- The RPC functions below run as SECURITY DEFINER, so the "require 2fa when enrolled" policies from
-- 0034 don't apply inside them. An account with an authenticator that only passed the password (aal1)
-- could still create workspaces and see or answer invitations through them.
--
-- Each function keeps its body: the original is renamed to <name>_unchecked and closed to clients, and
-- a small wrapper under the old name checks the 2FA step first and then calls it. If a later migration
-- needs to change one of these, change the *_unchecked function (the wrapper stays as it is).
--
-- Also: anon loses EXECUTE on them (they act on the signed-in user only), and the unused
-- ensure_workspace_membership() repair helper is closed to clients.
-- consume_request_rate_limit stays callable at aal1 on purpose: it throttles recovery-code attempts.
-- Apply after 0037.
begin;

create or replace function public.require_mfa_step()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.mfa_requirement_met() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
end
$$;
revoke all on function public.require_mfa_step() from public, anon, authenticated;

-- Rename once; running this migration again keeps the existing *_unchecked functions.
do $$
declare
  fn record;
begin
  for fn in
    select * from (values
      ('create_workspace', 'text, text'),
      ('accept_workspace_invitation', 'text'),
      ('list_my_invitations', ''),
      ('respond_to_my_invitation', 'uuid, boolean')
    ) as f(name, args)
  loop
    if to_regprocedure('public.' || fn.name || '_unchecked(' || fn.args || ')') is null then
      execute format('alter function public.%I(%s) rename to %I', fn.name, fn.args, fn.name || '_unchecked');
    end if;
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', fn.name || '_unchecked', fn.args);
  end loop;
end
$$;

create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_mfa_step();
  return public.create_workspace_unchecked(workspace_name, workspace_slug);
end
$$;

create or replace function public.accept_workspace_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_mfa_step();
  return public.accept_workspace_invitation_unchecked(invitation_token_hash);
end
$$;

create or replace function public.list_my_invitations()
returns table (id uuid, workspace_id uuid, workspace_name text, role text, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_mfa_step();
  return query select * from public.list_my_invitations_unchecked();
end
$$;

create or replace function public.respond_to_my_invitation(invitation_id uuid, accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_mfa_step();
  return public.respond_to_my_invitation_unchecked(invitation_id, accept);
end
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
revoke all on function public.accept_workspace_invitation(text) from public, anon;
revoke all on function public.list_my_invitations() from public, anon;
revoke all on function public.respond_to_my_invitation(uuid, boolean) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.list_my_invitations() to authenticated;
grant execute on function public.respond_to_my_invitation(uuid, boolean) to authenticated;

revoke all on function public.ensure_workspace_membership() from public, anon, authenticated;

commit;
