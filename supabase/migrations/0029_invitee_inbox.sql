-- In-app invitation inbox: invitees see and answer their own pending invitations
-- without the emailed token. Additive only: one nullable column and three functions.

alter table public.workspace_invitations add column if not exists declined_at timestamptz;

-- Answering by id (no token) is only safe when the caller provably owns the address,
-- so require a confirmed email on the auth user, not just the JWT claim.
create or replace function public.current_user_confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;
revoke all on function public.current_user_confirmed_email() from public;

create or replace function public.list_my_invitations()
returns table (id uuid, workspace_id uuid, workspace_name text, role text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select invitation.id, invitation.workspace_id, workspace.name, invitation.role, invitation.created_at, invitation.expires_at
  from public.workspace_invitations invitation
  join public.workspaces workspace on workspace.id = invitation.workspace_id
  where lower(invitation.email) = public.current_user_confirmed_email()
    and invitation.accepted_at is null
    and invitation.declined_at is null
    and invitation.expires_at > now()
    and not exists (
      select 1 from public.workspace_members member
      where member.workspace_id = invitation.workspace_id and member.user_id = auth.uid()
    )
  order by invitation.created_at desc
$$;
revoke all on function public.list_my_invitations() from public;
grant execute on function public.list_my_invitations() to authenticated;

create or replace function public.respond_to_my_invitation(invitation_id uuid, accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.workspace_invitations%rowtype;
  confirmed_email text := public.current_user_confirmed_email();
begin
  if auth.uid() is null or confirmed_email is null then
    raise exception 'Confirm your email address before answering invitations.' using errcode = '42501';
  end if;

  select * into invitation
  from public.workspace_invitations
  where id = invitation_id and accepted_at is null and declined_at is null and expires_at > now()
  for update;

  if invitation.id is null or lower(invitation.email) <> confirmed_email then
    raise exception 'This invitation is invalid or expired.' using errcode = '22023';
  end if;

  if not accept then
    update public.workspace_invitations set declined_at = now() where id = invitation.id;
    return invitation.workspace_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Same as the link flow, but switch to the joined workspace: the user just chose it.
  insert into public.profiles (id, active_workspace_id)
  values (auth.uid(), invitation.workspace_id)
  on conflict (id) do update set active_workspace_id = excluded.active_workspace_id, updated_at = now();

  update public.workspace_invitations set accepted_at = now() where id = invitation.id;
  return invitation.workspace_id;
end;
$$;
revoke all on function public.respond_to_my_invitation(uuid, boolean) from public;
grant execute on function public.respond_to_my_invitation(uuid, boolean) to authenticated;

-- The emailed-link flow must not resurrect an invitation the invitee already declined.
create or replace function public.accept_workspace_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'You must sign in to accept this invitation.' using errcode = '42501';
  end if;

  select * into invitation
  from public.workspace_invitations
  where token_hash = invitation_token_hash and accepted_at is null and declined_at is null and expires_at > now()
  for update;

  if invitation.id is null or lower(invitation.email) <> current_email then
    raise exception 'This invitation is invalid or expired.' using errcode = '22023';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  insert into public.profiles (id, active_workspace_id)
  values (auth.uid(), invitation.workspace_id)
  on conflict (id) do update set active_workspace_id = coalesce(public.profiles.active_workspace_id, excluded.active_workspace_id), updated_at = now();

  update public.workspace_invitations set accepted_at = now() where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invitation(text) to authenticated;
