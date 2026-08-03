drop policy if exists "owners can read own workspaces" on public.workspaces;
create policy "owners can read own workspaces" on public.workspaces for select using (owner_id = auth.uid());

create or replace function public.ensure_workspace_membership()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_workspace_id uuid;
begin
  select id into existing_workspace_id
  from public.workspaces
  where owner_id = auth.uid()
  order by created_at desc
  limit 1;

  if existing_workspace_id is null then
    return null;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (existing_workspace_id, auth.uid(), 'admin')
  on conflict (workspace_id, user_id) do nothing;

  return existing_workspace_id;
end;
$$;

grant execute on function public.ensure_workspace_membership() to authenticated;
