create or replace function public.can_manage_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid,
  requested_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members actor
    join public.workspace_members target on target.workspace_id = actor.workspace_id
    join public.workspaces workspace on workspace.id = actor.workspace_id
    where actor.workspace_id = target_workspace_id
      and actor.user_id = auth.uid()
      and target.user_id = target_user_id
      and target.user_id <> workspace.owner_id
      and target.role <> 'super_admin'
      and (requested_role is null or requested_role in ('user', 'admin'))
      and (
        actor.role = 'super_admin'
        or (actor.role = 'admin' and target.role = 'user' and coalesce(requested_role, 'user') = 'user')
      )
  );
$$;

revoke all on function public.can_manage_workspace_member(uuid, uuid, text) from public;
grant execute on function public.can_manage_workspace_member(uuid, uuid, text) to authenticated;

drop policy if exists "workspace admins can update memberships" on public.workspace_members;
create policy "workspace admins can update memberships" on public.workspace_members
for update
using (public.can_manage_workspace_member(workspace_id, user_id))
with check (public.can_manage_workspace_member(workspace_id, user_id, role));

drop policy if exists "workspace admins can remove memberships" on public.workspace_members;
create policy "workspace admins can remove memberships" on public.workspace_members
for delete using (public.can_manage_workspace_member(workspace_id, user_id));

drop policy if exists "admins can create invitations" on public.workspace_invitations;
create policy "admins can create invitations" on public.workspace_invitations
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members actor
    where actor.workspace_id = workspace_invitations.workspace_id
      and actor.user_id = auth.uid()
      and (actor.role = 'super_admin' or (actor.role = 'admin' and workspace_invitations.role = 'user'))
  )
);

drop policy if exists "admins can delete invitations" on public.workspace_invitations;
create policy "admins can delete invitations" on public.workspace_invitations
for delete using (
  exists (
    select 1
    from public.workspace_members actor
    where actor.workspace_id = workspace_invitations.workspace_id
      and actor.user_id = auth.uid()
      and (actor.role = 'super_admin' or (actor.role = 'admin' and workspace_invitations.role = 'user'))
  )
);

update public.workspace_invitations invitation
set expires_at = least(invitation.expires_at, now())
where invitation.accepted_at is null
  and invitation.role = 'admin'
  and not exists (
    select 1
    from public.workspace_members creator
    where creator.workspace_id = invitation.workspace_id
      and creator.user_id = invitation.created_by
      and creator.role = 'super_admin'
  );

create or replace function public.prevent_workspace_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Workspace ownership cannot be changed directly.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_workspace_owner on public.workspaces;
create trigger protect_workspace_owner
before update of owner_id on public.workspaces
for each row execute function public.prevent_workspace_owner_change();
