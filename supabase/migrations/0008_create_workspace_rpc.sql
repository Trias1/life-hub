create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (id, owner_id, name, slug)
  values (new_workspace_id, current_user_id, workspace_name, workspace_slug);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;
