-- Members could only read their own membership row (0009), so the Team page listed only the viewer,
-- and assigning a task or adding an attendee failed the app's "is this person a member?" check.
-- Let members read every membership of the workspaces they belong to, and nothing else.
-- The check goes through a SECURITY DEFINER function so the policy doesn't recurse into itself.
-- Apply after 0032.
begin;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace_id and m.user_id = auth.uid())
$$;
revoke all on function public.is_workspace_member(uuid) from public;
-- anon gets false (no auth.uid()), so signed-out reads keep returning no rows instead of an error.
grant execute on function public.is_workspace_member(uuid) to anon, authenticated;

drop policy if exists "members can read fellow memberships" on public.workspace_members;
create policy "members can read fellow memberships" on public.workspace_members
for select using (public.is_workspace_member(workspace_id));

commit;
